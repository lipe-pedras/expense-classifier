from entities.document_context import DocumentContext
from pipeline.segmentation_stage import SegmentationStage


def test_segmentation_stage_populates_segments():
    ctx = DocumentContext("d", "u", "/f", "PDF", raw_text="Block one content\n\nBlock two content")
    SegmentationStage().process(ctx)
    assert len(ctx.segments) == 2


def test_segmentation_stage_empty_text_produces_no_segments():
    ctx = DocumentContext("d", "u", "/f", "PDF", raw_text="")
    SegmentationStage().process(ctx)
    assert ctx.segments == []
