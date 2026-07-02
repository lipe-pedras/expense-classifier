"""
Reconstruct reading-order text from EasyOCR bounding boxes.

EasyOCR's ``paragraph=True`` mode clusters detected text into paragraph blocks,
which collapses table columns — every line-item description ends up in one block
and every value in another, so a bill's "description → amount" pairing is lost
and the downstream LLM can only anchor to the single most prominent total.

Instead we run OCR with ``detail=1, paragraph=False`` (individual boxes with
coordinates) and rebuild rows: group boxes whose vertical centres are close into
the same line, then order each line left-to-right. This preserves the tabular
description↔value alignment.
"""
from __future__ import annotations

from typing import Sequence


def boxes_to_lines(boxes: Sequence) -> str:
    """
    Turn EasyOCR ``detail=1`` output into reading-order text.

    ``boxes`` is a sequence of ``(bbox, text, confidence)`` where ``bbox`` is four
    ``(x, y)`` corner points. Boxes are grouped into rows by vertical proximity
    (tolerance = 60% of a box's height) and ordered left-to-right within each row.
    """
    items = []
    for entry in boxes:
        bbox, text = entry[0], entry[1]
        ys = [float(p[1]) for p in bbox]
        xs = [float(p[0]) for p in bbox]
        y_center = sum(ys) / len(ys)
        height = max(ys) - min(ys)
        items.append((y_center, min(xs), height, text))

    items.sort(key=lambda t: t[0])

    rows: list[list[tuple[float, str]]] = []
    row: list[tuple[float, str]] = []
    row_y: float | None = None
    row_tol = 0.0
    for y_center, x_left, height, text in items:
        if row_y is None or abs(y_center - row_y) <= row_tol:
            row.append((x_left, text))
            if row_y is None:
                row_y = y_center
                row_tol = max(height * 0.6, 1.0)
        else:
            rows.append(row)
            row = [(x_left, text)]
            row_y = y_center
            row_tol = max(height * 0.6, 1.0)
    if row:
        rows.append(row)

    return "\n".join(
        " ".join(text for _, text in sorted(r, key=lambda t: t[0])) for r in rows
    )


def ocr_image(reader, image) -> str:
    """Run EasyOCR on an image array and return coordinate-reconstructed text."""
    boxes = reader.readtext(image, detail=1, paragraph=False)
    return boxes_to_lines(boxes)
