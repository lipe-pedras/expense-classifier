import asyncio
import json
import logging
import sys

from bullmq import Queue, Worker

from config import config
from entities.document_context import DocumentContext
from extraction.extraction_strategy_factory import ExtractionStrategyFactory
from pipeline.document_pipeline import DocumentPipeline
from pipeline.extraction_stage import ExtractionStage
from pipeline.segmentation_stage import SegmentationStage
from pipeline.preprocessing_stage import PreprocessingStage
from pipeline.validation_stage import ValidationStage
from jobs import (
    CLASSIFICATION_JOB_NAME,
    CLASSIFICATION_QUEUE_NAME,
    build_classification_job,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("extractor")

QUEUE_NAME = "document-processing"

_classification_queue: Queue | None = None


def _get_classification_queue() -> Queue:
    """Lazily create the shared producer handle for the classification queue."""
    global _classification_queue
    if _classification_queue is None:
        _classification_queue = Queue(
            CLASSIFICATION_QUEUE_NAME,
            {"connection": config.redis_url},
        )
    return _classification_queue


def build_extraction_pipeline() -> DocumentPipeline:
    """Extraction half of the pipeline: extract → segment → validate → preprocess."""
    factory = ExtractionStrategyFactory(
        gpu=config.easyocr_gpu,
        engine=config.extraction_engine,
        fallback=config.extraction_fallback,
        docling_device=config.docling_device,
    )
    stages = [
        ExtractionStage(factory),
        SegmentationStage(),
        ValidationStage(),
        PreprocessingStage(),
    ]
    return DocumentPipeline(stages)


async def _enqueue_classification(job_data: dict) -> None:
    """Hand the preprocessed segments off to the llm-worker."""
    queue = _get_classification_queue()
    await queue.add(
        CLASSIFICATION_JOB_NAME,
        job_data,
        {
            "attempts": 3,
            "backoff": {"type": "exponential", "delay": 1000},
            "removeOnComplete": True,
            "removeOnFail": False,
        },
    )


async def process_job(job, job_token=None):
    data = job.data
    logger.info("Extracting job %s for document %s", job.id, data.get("documentId"))

    ctx = DocumentContext(
        document_id=data["documentId"],
        user_id=data["userId"],
        file_path=data["filePath"],
        file_type=data["fileType"],
        categories=data.get("categories", []),
    )

    pipeline = build_extraction_pipeline()
    # OCR/extraction is fully synchronous and blocking. Offload it to a worker
    # thread so the asyncio loop stays free to renew the BullMQ job lock (see the
    # llm-worker for the same rationale on the inference call).
    await asyncio.to_thread(pipeline.run, ctx)

    await _enqueue_classification(build_classification_job(ctx))

    logger.info(
        "Job %s extracted — enqueued %d segment(s) for classification",
        job.id,
        len(ctx.segments),
    )
    # Handing off does NOT complete the document — the API marks it DONE only
    # when the classification job finishes. Returned for logging/observability.
    return json.dumps({"documentId": ctx.document_id, "userId": ctx.user_id, "stage": "extracted"})


async def main() -> None:
    logger.info("Starting extractor, connecting to Redis at %s", config.redis_url)
    Worker(
        QUEUE_NAME,
        process_job,
        {
            "connection": config.redis_url,
            "concurrency": 1,
            # Generous lock margin so an unusually slow extraction can never be
            # mistaken for a stalled job and reprocessed.
            "lockDuration": 300_000,
        },
    )
    logger.info("Extractor listening on queue '%s'", QUEUE_NAME)
    # bullmq Worker starts its own asyncio task on __init__; keep the loop alive
    await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
