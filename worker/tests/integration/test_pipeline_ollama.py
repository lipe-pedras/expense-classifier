"""
Integration test: runs the LlmClassifier against a live Ollama instance.
Skipped automatically when OLLAMA_URL is not set or Ollama is unreachable.
"""
import os
import pytest
import httpx

from classification.llm_classifier import LlmClassifier


def _ollama_available() -> bool:
    url = os.environ.get("OLLAMA_URL", "http://ollama:11434")
    try:
        httpx.get(f"{url.rstrip('/')}/", timeout=5).raise_for_status()
        return True
    except Exception:
        return False


pytestmark = pytest.mark.integration

requires_ollama = pytest.mark.skipif(
    not _ollama_available(),
    reason="Ollama is not reachable",
)


@requires_ollama
def test_classify_electricity_bill():
    """LlmClassifier returns at least one result for a clearly worded electricity bill."""
    url = os.environ.get("OLLAMA_URL", "http://ollama:11434")
    model = os.environ.get("OLLAMA_MODEL", "qwen2.5:7b-instruct-q3_K_M")
    classifier = LlmClassifier(base_url=url, model=model)

    text = (
        "CPFL Energia\n"
        "Nota Fiscal de Energia Elétrica\n"
        "Referência: Março/2024\n"
        "Valor total: R$ 187,50\n"
        "Vencimento: 15/03/2024\n"
    )
    results = classifier.classify(page_index=0, text=text)

    assert len(results) >= 1
    result = results[0]
    assert result.category_slug == "electricity"
    assert result.amount > 0
    assert result.currency == "BRL"
    assert result.confidence > 0.5


@requires_ollama
def test_classify_empty_page_returns_empty_list():
    """LlmClassifier returns an empty list for a page with no expense content."""
    url = os.environ.get("OLLAMA_URL", "http://ollama:11434")
    model = os.environ.get("OLLAMA_MODEL", "qwen2.5:7b-instruct-q3_K_M")
    classifier = LlmClassifier(base_url=url, model=model)

    results = classifier.classify(page_index=0, text="Page intentionally left blank.")

    assert isinstance(results, list)
