import json
from datetime import date
from unittest.mock import MagicMock, patch

import httpx
import pytest

from classification.llm_classifier import LlmClassifier
from entities.classification_result import ClassificationResult


def make_client(response_content: str) -> httpx.Client:
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = {
        "message": {"content": response_content}
    }
    mock_client = MagicMock(spec=httpx.Client)
    mock_client.post.return_value = mock_response
    return mock_client


def test_classify_returns_list():
    payload = json.dumps([{
        "category_slug": "electricity",
        "vendor": "City Power Co",
        "amount": 123.45,
        "currency": "USD",
        "expense_date": "2026-01-15",
        "confidence": 0.92,
    }])
    client = make_client(payload)
    classifier = LlmClassifier("http://ollama:11434", "test-model", client=client)

    results = classifier.classify(0, "Electric bill Jan 2026")

    assert isinstance(results, list)
    assert len(results) == 1
    result = results[0]
    assert result.category_slug == "electricity"
    assert result.vendor == "City Power Co"
    assert result.amount == 123.45
    assert result.currency == "USD"
    assert result.expense_date == date(2026, 1, 15)
    assert result.confidence == 0.92
    assert result.segment_index == 0


def test_classify_multiple_expenses_on_one_page():
    payload = json.dumps([
        {
            "category_slug": "electricity",
            "vendor": "Power Co",
            "amount": 100.0,
            "currency": "BRL",
            "expense_date": "2026-01-15",
            "confidence": 0.9,
        },
        {
            "category_slug": "water",
            "vendor": "Water Co",
            "amount": 50.0,
            "currency": "BRL",
            "expense_date": "2026-01-15",
            "confidence": 0.85,
        },
    ])
    client = make_client(payload)
    classifier = LlmClassifier("http://ollama:11434", "test-model", client=client)

    results = classifier.classify(0, "Combined utility bill")

    assert len(results) == 2
    assert results[0].category_slug == "electricity"
    assert results[1].category_slug == "water"


def test_classify_empty_array_returns_empty_list():
    client = make_client("[]")
    classifier = LlmClassifier("http://ollama:11434", "test-model", client=client)

    results = classifier.classify(0, "blank page")

    assert results == []


def test_classify_invalid_json_returns_fallback_list():
    client = make_client("not valid json {{{")
    classifier = LlmClassifier("http://ollama:11434", "test-model", client=client)

    results = classifier.classify(1, "some text")

    assert len(results) == 1
    assert results[0].category_slug == "other"
    assert results[0].amount == 0.0
    assert results[0].confidence == 0.0
    assert results[0].segment_index == 1


def test_classify_single_object_wrapped_in_list():
    payload = json.dumps({
        "category_slug": "rent",
        "vendor": "Landlord",
        "amount": 1000.0,
        "currency": "BRL",
        "expense_date": "2026-01-01",
        "confidence": 0.95,
    })
    client = make_client(payload)
    classifier = LlmClassifier("http://ollama:11434", "test-model", client=client)

    results = classifier.classify(0, "rent receipt")

    assert isinstance(results, list)
    assert len(results) == 1
    assert results[0].category_slug == "rent"


def test_classify_unknown_slug_becomes_other():
    payload = json.dumps([{
        "category_slug": "groceries",
        "vendor": None,
        "amount": 50.0,
        "currency": "BRL",
        "expense_date": "2026-01-01",
        "confidence": 0.8,
    }])
    client = make_client(payload)
    classifier = LlmClassifier("http://ollama:11434", "test-model", client=client)

    results = classifier.classify(0, "text")

    assert results[0].category_slug == "other"


def test_classify_missing_date_uses_today():
    payload = json.dumps([{
        "category_slug": "rent",
        "vendor": "Landlord",
        "amount": 1000.0,
        "currency": "BRL",
        "expense_date": "",
        "confidence": 0.7,
    }])
    client = make_client(payload)
    classifier = LlmClassifier("http://ollama:11434", "test-model", client=client)

    results = classifier.classify(0, "rent receipt")

    assert results[0].expense_date == date.today()


def test_classify_propagates_http_error():
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
        "500", request=MagicMock(), response=mock_response
    )
    mock_client = MagicMock(spec=httpx.Client)
    mock_client.post.return_value = mock_response
    classifier = LlmClassifier("http://ollama:11434", "test-model", client=mock_client)

    with pytest.raises(httpx.HTTPStatusError):
        classifier.classify(0, "text")
