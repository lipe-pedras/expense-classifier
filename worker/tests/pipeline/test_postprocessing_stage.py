from datetime import date, timedelta

from entities.classification_result import ClassificationResult
from entities.document_context import DocumentContext
from pipeline.postprocessing_stage import PostprocessingStage


def make_result(**kwargs) -> ClassificationResult:
    defaults = dict(
        segment_index=0,
        category_slug="rent",
        vendor="Landlord",
        amount=500.0,
        currency="BRL",
        expense_date=date(2026, 1, 1),
        confidence=0.9,
        raw_text="x",
    )
    defaults.update(kwargs)
    return ClassificationResult(**defaults)


def test_postprocessing_stage_applies_fixes():
    ctx = DocumentContext("d", "u", "/f", "PDF")
    future = date.today() + timedelta(days=5)
    ctx._classification_results = [make_result(confidence=2.0, expense_date=future)]

    PostprocessingStage().process(ctx)

    result = ctx._classification_results[0]
    assert result.confidence == 1.0  # clamped
    assert result.expense_date == date.today()  # future → today


def test_postprocessing_stage_deduplicates():
    ctx = DocumentContext("d", "u", "/f", "PDF")
    r1 = make_result()
    r2 = make_result()  # identical — should be dropped
    ctx._classification_results = [r1, r2]

    PostprocessingStage().process(ctx)

    assert len(ctx._classification_results) == 1


def test_postprocessing_stage_no_results_does_nothing():
    ctx = DocumentContext("d", "u", "/f", "PDF")
    ctx._classification_results = []
    PostprocessingStage().process(ctx)  # should not raise
    assert ctx._classification_results == []
