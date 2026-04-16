import asyncio
import json
import logging
import sys

from bullmq import Worker

from config import config
from entities.document_context import DocumentContext
from extraction.extraction_strategy_factory import ExtractionStrategyFactory
from classification.llm_classifier import LlmClassifier
from api_client.internal_api_client import InternalApiClient
from pipeline.document_pipeline import DocumentPipeline
from pipeline.extraction_stage import ExtractionStage
from pipeline.segmentation_stage import SegmentationStage
from pipeline.preprocessing_stage import PreprocessingStage
from pipeline.validation_stage import ValidationStage
from pipeline.classification_stage import ClassificationStage
from pipeline.postprocessing_stage import PostprocessingStage
from pipeline.persistence_stage import PersistenceStage

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("worker")

QUEUE_NAME = "document-processing"


def build_pipeline() -> DocumentPipeline:
    factory = ExtractionStrategyFactory(gpu=config.easyocr_gpu)
    classifier = LlmClassifier(base_url=config.ollama_url, model=config.ollama_model)
    api_client = InternalApiClient(
        base_url=config.api_base_url,
        token=config.internal_service_token,
    )
    stages = [
        ExtractionStage(factory),
        SegmentationStage(),
        ValidationStage(),
        PreprocessingStage(),
        ClassificationStage(classifier),
        PostprocessingStage(),
        PersistenceStage(api_client),
    ]
    return DocumentPipeline(stages)


async def process_job(job, job_token=None):
    data = job.data
    logger.info("Processing job %s for document %s", job.id, data.get("documentId"))

    ctx = DocumentContext(
        document_id=data["documentId"],
        user_id=data["userId"],
        file_path=data["filePath"],
        file_type=data["fileType"],
    )

    pipeline = build_pipeline()
    pipeline.run(ctx)

    logger.info("Job %s completed — %d segment(s)", job.id, len(ctx.segments))
    # Return value is picked up by QueueEvents on the API side
    return json.dumps({"documentId": ctx.document_id, "userId": ctx.user_id})


async def main() -> None:
    logger.info("Starting worker, connecting to Redis at %s", config.redis_url)
    Worker(QUEUE_NAME, process_job, {"connection": config.redis_url})
    logger.info("Worker listening on queue '%s'", QUEUE_NAME)
    # bullmq Worker starts its own asyncio task on __init__; keep the loop alive
    await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
