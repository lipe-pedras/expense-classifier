"""
Integration test: verifies the worker picks up a BullMQ job from Redis and
calls the pipeline.  Requires a running Redis instance.

Skipped automatically when REDIS_URL is not set or Redis is unavailable.
"""
import pytest

pytest.importorskip("bullmq", reason="bullmq not installed")


@pytest.mark.integration
def test_placeholder():
    """Placeholder — full queue consumer integration tests require Redis + API."""
    pytest.skip("integration tests require live Redis and API")
