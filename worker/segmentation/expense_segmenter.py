import re

from entities.document_context import DocumentContext, DocumentSegment

# A blank line (possibly with whitespace) acts as a segment boundary.
# Documents that produce only a single block are treated as single-expense.
_SEGMENT_SEPARATOR = re.compile(r"\n\s*\n")

# Minimum number of non-whitespace characters for a segment to be meaningful
_MIN_SEGMENT_CHARS = 10


def segment(ctx: DocumentContext) -> None:
    """
    Split ``ctx.raw_text`` into individual expense segments and write them
    into ``ctx.segments``.

    Strategy: split on double-newlines.  If no split occurs (single block),
    treat the whole document as one segment.
    """
    parts = _SEGMENT_SEPARATOR.split(ctx.raw_text)
    segments: list[DocumentSegment] = []
    index = 0
    for part in parts:
        stripped = part.strip()
        if len(re.sub(r"\s+", "", stripped)) < _MIN_SEGMENT_CHARS:
            continue
        segments.append(DocumentSegment(index=index, raw_text=stripped))
        index += 1

    if not segments and ctx.raw_text.strip():
        segments.append(DocumentSegment(index=0, raw_text=ctx.raw_text.strip()))

    ctx.segments = segments
