from datetime import date
from unittest.mock import MagicMock

from entities.classification_result import ClassificationResult
from entities.document_context import DocumentContext, DocumentSegment
from classification.llm_classifier import LlmClassifier
from pipeline.classification_stage import ClassificationStage


def make_result(idx: int, category: str = "rent") -> ClassificationResult:
    return ClassificationResult(
        segment_index=idx,
        category_slug=category,
        vendor="Landlord",
        amount=1000.0,
        currency="BRL",
        expense_date=date(2026, 1, 1),
        confidence=0.9,
        raw_text="text",
    )


def test_classification_stage_flattens_results_from_all_pages():
    classifier = MagicMock(spec=LlmClassifier)
    # Page 0 returns 2 expenses, page 1 returns 1 expense
    classifier.classify.side_effect = [
        [make_result(0, "electricity"), make_result(0, "water")],
        [make_result(1, "rent")],
    ]

    ctx = DocumentContext("d", "u", "/f", "PDF")
    ctx.segments = [
        DocumentSegment(index=0, raw_text="seg0", normalised_text="seg0 norm"),
        DocumentSegment(index=1, raw_text="seg1", normalised_text="seg1 norm"),
    ]

    ClassificationStage(classifier).process(ctx)

    assert len(ctx._classification_results) == 3
    assert classifier.classify.call_count == 2
    classifier.classify.assert_any_call(0, "seg0 norm")
    classifier.classify.assert_any_call(1, "seg1 norm")


def test_classification_stage_falls_back_to_raw_text_when_normalised_empty():
    classifier = MagicMock(spec=LlmClassifier)
    classifier.classify.return_value = [make_result(0)]

    ctx = DocumentContext("d", "u", "/f", "PDF")
    ctx.segments = [DocumentSegment(index=0, raw_text="raw text", normalised_text="")]

    ClassificationStage(classifier).process(ctx)

    classifier.classify.assert_called_once_with(0, "raw text")


def test_classification_stage_empty_page_response():
    classifier = MagicMock(spec=LlmClassifier)
    classifier.classify.return_value = []

    ctx = DocumentContext("d", "u", "/f", "PDF")
    ctx.segments = [DocumentSegment(index=0, raw_text="blank page", normalised_text="blank page")]

    ClassificationStage(classifier).process(ctx)

    assert ctx._classification_results == []
