from entities.document_context import DocumentContext, DocumentSegment


def test_document_context_defaults():
    ctx = DocumentContext(
        document_id="doc-1",
        user_id="user-1",
        file_path="/uploads/test.pdf",
        file_type="PDF",
    )
    assert ctx.raw_text == ""
    assert ctx.segments == []
    assert ctx.errors == []


def test_document_segment_fields():
    seg = DocumentSegment(index=0, raw_text="Invoice $100")
    assert seg.index == 0
    assert seg.raw_text == "Invoice $100"
    assert seg.normalised_text == ""
