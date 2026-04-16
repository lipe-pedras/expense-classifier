import pytest

from entities.document_context import DocumentContext, DocumentSegment
from pipeline.validation_stage import ValidationStage, ValidationError


def make_valid_ctx() -> DocumentContext:
    ctx = DocumentContext("d", "u", "/f", "PDF", raw_text="Some content")
    ctx.segments = [DocumentSegment(index=0, raw_text="Some content")]
    return ctx


def test_valid_context_passes():
    ValidationStage().process(make_valid_ctx())  # no exception


def test_empty_raw_text_raises():
    ctx = DocumentContext("d", "u", "/f", "PDF", raw_text="")
    ctx.segments = []
    with pytest.raises(ValidationError, match="No text"):
        ValidationStage().process(ctx)


def test_no_segments_raises():
    ctx = DocumentContext("d", "u", "/f", "PDF", raw_text="Some content")
    ctx.segments = []
    with pytest.raises(ValidationError, match="no segments"):
        ValidationStage().process(ctx)


def test_accumulated_errors_raises():
    ctx = make_valid_ctx()
    ctx.errors = ["Something went wrong"]
    with pytest.raises(ValidationError, match="Something went wrong"):
        ValidationStage().process(ctx)
