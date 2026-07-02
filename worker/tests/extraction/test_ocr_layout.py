from extraction.ocr_layout import boxes_to_lines


def _box(x0, y0, x1, y1, text, conf=0.9):
    """EasyOCR detail=1 entry: (4-corner bbox, text, confidence)."""
    return ([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], text, conf)


def test_groups_same_row_left_to_right():
    # Two cells on the same visual row, given out of x-order.
    boxes = [
        _box(300, 10, 380, 30, "2.079,70"),
        _box(10, 12, 120, 32, "Aluguel"),
    ]
    assert boxes_to_lines(boxes) == "Aluguel 2.079,70"


def test_separates_distinct_rows_top_to_bottom():
    boxes = [
        _box(10, 100, 120, 120, "IPTU"),
        _box(300, 100, 360, 120, "69,55"),
        _box(10, 10, 120, 30, "Aluguel"),
        _box(300, 12, 380, 32, "2.079,70"),
    ]
    assert boxes_to_lines(boxes) == "Aluguel 2.079,70\nIPTU 69,55"


def test_empty_input():
    assert boxes_to_lines([]) == ""
