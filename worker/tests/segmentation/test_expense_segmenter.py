from entities.document_context import DocumentContext
from segmentation.expense_segmenter import segment


def make_ctx(raw_pages: list[str]) -> DocumentContext:
    return DocumentContext(
        document_id="doc-1",
        user_id="user-1",
        file_path="/uploads/test.pdf",
        file_type="PDF",
        raw_pages=raw_pages,
    )


def test_single_page_produces_one_segment():
    ctx = make_ctx(["Invoice from Acme Corp\nTotal: $100.00\nDate: 2026-01-15"])
    segment(ctx)
    assert len(ctx.segments) == 1
    assert ctx.segments[0].index == 0


def test_two_pages_produce_two_segments():
    ctx = make_ctx(["Page one content", "Page two content"])
    segment(ctx)
    assert len(ctx.segments) == 2
    assert ctx.segments[0].index == 0
    assert ctx.segments[1].index == 1


def test_empty_page_is_skipped():
    ctx = make_ctx(["Real content here", "   ", "More content here"])
    segment(ctx)
    # The blank middle page is skipped; indices reflect page positions
    assert len(ctx.segments) == 2
    assert ctx.segments[0].index == 0
    assert ctx.segments[1].index == 2


def test_all_empty_pages_produce_no_segments():
    ctx = make_ctx(["   ", "\n\n", ""])
    segment(ctx)
    assert ctx.segments == []


def test_no_pages_produces_no_segments():
    ctx = make_ctx([])
    segment(ctx)
    assert ctx.segments == []


def test_segment_raw_text_is_stripped():
    ctx = make_ctx(["  Content with padding  ", "  Another page  "])
    segment(ctx)
    for seg in ctx.segments:
        assert seg.raw_text == seg.raw_text.strip()
