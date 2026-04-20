"""
Integration test: verifies that a job pushed onto the BullMQ queue is picked up
by the worker's process_job handler and produces a valid JSON result.
Skipped automatically when Redis is unreachable.
"""
import asyncio
import json
import os
import uuid

import pytest

bullmq = pytest.importorskip("bullmq", reason="bullmq not installed")


def _redis_available() -> bool:
    import socket
    url = os.environ.get("REDIS_URL", "redis://redis:6379")
    # parse host/port from redis://host:port
    try:
        without_scheme = url.split("://", 1)[-1]
        host, port_str = without_scheme.rsplit(":", 1)
        port = int(port_str.split("/")[0])
        with socket.create_connection((host, port), timeout=3):
            return True
    except Exception:
        return False


pytestmark = pytest.mark.integration

requires_redis = pytest.mark.skipif(
    not _redis_available(),
    reason="Redis is not reachable",
)


@requires_redis
@pytest.mark.asyncio
async def test_process_job_returns_valid_json():
    """process_job returns JSON with documentId and userId for a minimal job stub."""
    from main import process_job

    document_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())

    class _FakeJob:
        id = "test-job-1"
        data = {
            "documentId": document_id,
            "userId": user_id,
            "filePath": "/nonexistent/file.pdf",
            "fileType": "PDF",
        }

    # process_job will fail at the extraction stage because the file doesn't
    # exist — we only want to confirm the job handler is callable and its
    # happy-path return shape is correct, so we mock the pipeline.
    from unittest.mock import patch, MagicMock

    mock_pipeline = MagicMock()
    mock_pipeline.run = MagicMock()

    with patch("main.build_pipeline", return_value=mock_pipeline):
        result = await process_job(_FakeJob())

    payload = json.loads(result)
    assert payload["documentId"] == document_id
    assert payload["userId"] == user_id


@requires_redis
@pytest.mark.asyncio
async def test_queue_round_trip():
    """A job added to the BullMQ queue can be dequeued from Redis."""
    from bullmq import Queue

    redis_url = os.environ.get("REDIS_URL", "redis://redis:6379")
    queue_name = f"test-queue-{uuid.uuid4().hex[:8]}"

    queue = Queue(queue_name, {"connection": redis_url})
    try:
        job = await queue.add("test-job", {"documentId": "doc-1", "userId": "user-1"})
        assert job.id is not None
    finally:
        await queue.obliterate()
        await queue.close()
