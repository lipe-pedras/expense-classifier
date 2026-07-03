import asyncio
import json
import logging
import sys

from bullmq import Worker

from config import config
from classification.llm_classifier import LlmClassifier
from api_client.internal_api_client import InternalApiClient
from pipeline.document_pipeline import DocumentPipeline
from pipeline.classification_stage import ClassificationStage
from pipeline.postprocessing_stage import PostprocessingStage
from pipeline.persistence_stage import PersistenceStage
from jobs import CLASSIFICATION_QUEUE_NAME, context_from_classification_job

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("llm-worker")

QUEUE_NAME = CLASSIFICATION_QUEUE_NAME


def build_classification_pipeline() -> DocumentPipeline:
    """LLM half of the pipeline: classify → postprocess → persist."""
    classifier = LlmClassifier(base_url=config.ollama_url, model=config.ollama_model)
    api_client = InternalApiClient(
        base_url=config.api_base_url,
        token=config.internal_service_token,
    )
    stages = [
        ClassificationStage(classifier),
        PostprocessingStage(),
        PersistenceStage(api_client),
    ]
    return DocumentPipeline(stages)


async def process_job(job, job_token=None):
    data = job.data
    logger.info("Classifying job %s for document %s", job.id, data.get("documentId"))

    ctx = context_from_classification_job(data)

    pipeline = build_classification_pipeline()
    # The blocking Ollama HTTP call would starve the asyncio loop and prevent
    # BullMQ from renewing the job lock (marking it stalled and reprocessing —
    # which duplicates expenses). Offload it to a worker thread.
    await asyncio.to_thread(pipeline.run, ctx)

    logger.info("Job %s classified — %d segment(s)", job.id, len(ctx.segments))
    # Return value is picked up by QueueEvents on the API side to mark the
    # document DONE (this is the terminal stage).
    return json.dumps({"documentId": ctx.document_id, "userId": ctx.user_id})


async def prewarm_ollama() -> None:
    """Trigger the cold model load up-front so the first real job isn't slow."""
    try:
        classifier = LlmClassifier(base_url=config.ollama_url, model=config.ollama_model)
        await asyncio.to_thread(classifier.classify, 0, "warmup")
        logger.info("Ollama model pre-warmed")
    except Exception as exc:  # best-effort; never block startup
        logger.warning("Ollama pre-warm failed (will warm on first job): %s", exc)


async def main() -> None:
    logger.info("Starting llm-worker, connecting to Redis at %s", config.redis_url)
    await prewarm_ollama()
    Worker(
        QUEUE_NAME,
        process_job,
        {
            "connection": config.redis_url,
            "concurrency": 1,
            # Generous lock margin so an unusually slow inference can never be
            # mistaken for a stalled job and reprocessed.
            "lockDuration": 300_000,
        },
    )
    logger.info("LLM worker listening on queue '%s'", QUEUE_NAME)
    # bullmq Worker starts its own asyncio task on __init__; keep the loop alive
    await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
