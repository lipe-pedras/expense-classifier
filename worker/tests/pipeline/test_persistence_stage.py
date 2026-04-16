from datetime import date
from unittest.mock import MagicMock

from entities.classification_result import ClassificationResult
from entities.document_context import DocumentContext
from api_client.internal_api_client import InternalApiClient
from pipeline.persistence_stage import PersistenceStage


def make_result(idx: int) -> ClassificationResult:
    return ClassificationResult(
        segment_index=idx,
        category_slug="water",
        vendor="City Water",
        amount=45.0,
        currency="BRL",
        expense_date=date(2026, 1, 10),
        confidence=0.85,
        raw_text="water bill",
    )


def test_persistence_stage_posts_each_result():
    client = MagicMock(spec=InternalApiClient)
    ctx = DocumentContext("doc-1", "user-1", "/f", "PDF")
    ctx._classification_results = [make_result(0), make_result(1)]

    PersistenceStage(client).process(ctx)

    assert client.post_result.call_count == 2
    client.post_result.assert_any_call("doc-1", "user-1", ctx._classification_results[0])
    client.post_result.assert_any_call("doc-1", "user-1", ctx._classification_results[1])


def test_persistence_stage_no_results_makes_no_calls():
    client = MagicMock(spec=InternalApiClient)
    ctx = DocumentContext("doc-1", "user-1", "/f", "PDF")
    ctx._classification_results = []

    PersistenceStage(client).process(ctx)

    client.post_result.assert_not_called()
