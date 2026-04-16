"""
Integration test: runs the full document pipeline against a live Ollama
instance.  Skipped unless OLLAMA_URL is set and the model is available.
"""
import pytest


@pytest.mark.integration
def test_placeholder():
    """Placeholder — full pipeline integration tests require Ollama + a test document."""
    pytest.skip("integration tests require live Ollama instance and test fixtures")
