from entities.document_context import DocumentContext, DocumentSegment
from pipeline.preprocessing_stage import PreprocessingStage


def test_preprocessing_stage_normalises_segments():
    ctx = DocumentContext("d", "u", "/f", "PDF")
    ctx.segments = [
        DocumentSegment(index=0, raw_text="  hello   world  "),
        DocumentSegment(index=1, raw_text="line1\nline2"),
    ]
    PreprocessingStage().process(ctx)

    assert ctx.segments[0].normalised_text == "hello world"
    assert ctx.segments[1].normalised_text == "line1\nline2"


def test_preprocessing_stage_no_segments_does_nothing():
    ctx = DocumentContext("d", "u", "/f", "PDF")
    PreprocessingStage().process(ctx)  # should not raise
    assert ctx.segments == []
