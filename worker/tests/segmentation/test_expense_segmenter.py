from entities.document_context import DocumentContext
from segmentation.expense_segmenter import segment


def make_ctx(raw_text: str) -> DocumentContext:
    return DocumentContext(
        document_id="doc-1",
        user_id="user-1",
        file_path="/uploads/test.pdf",
        file_type="PDF",
        raw_text=raw_text,
    )


def test_single_block_produces_one_segment():
    ctx = make_ctx("Invoice from Acme Corp\nTotal: $100.00\nDate: 2026-01-15")
    segment(ctx)
    assert len(ctx.segments) == 1
    assert ctx.segments[0].index == 0


def test_double_newline_splits_into_two_segments():
    ctx = make_ctx("Segment one\n\nSegment two content here")
    segment(ctx)
    assert len(ctx.segments) == 2
    assert ctx.segments[0].index == 0
    assert ctx.segments[1].index == 1


def test_blank_line_with_whitespace_is_separator():
    ctx = make_ctx("Block A content\n   \nBlock B content")
    segment(ctx)
    assert len(ctx.segments) == 2


def test_very_short_parts_are_filtered():
    ctx = make_ctx("Real content here yes\n\nx\n\nAnother real block here")
    segment(ctx)
    # "x" is too short to be a segment
    assert len(ctx.segments) == 2


def test_empty_text_produces_no_segments():
    ctx = make_ctx("   ")
    segment(ctx)
    assert ctx.segments == []


def test_segment_raw_text_is_stripped():
    ctx = make_ctx("  Content with padding  \n\n  Another block  ")
    segment(ctx)
    for seg in ctx.segments:
        assert seg.raw_text == seg.raw_text.strip()
