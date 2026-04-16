from entities.document_context import DocumentContext, DocumentSegment


def segment(ctx: DocumentContext) -> None:
    """
    Split ``ctx.raw_pages`` into one DocumentSegment per page.

    Pages that contain no meaningful text (empty after stripping) are skipped.
    """
    segments: list[DocumentSegment] = []
    for index, page_text in enumerate(ctx.raw_pages):
        stripped = page_text.strip()
        if stripped:
            segments.append(DocumentSegment(index=index, raw_text=stripped))
    ctx.segments = segments
