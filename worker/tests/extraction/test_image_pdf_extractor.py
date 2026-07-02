from unittest.mock import MagicMock, patch

import numpy as np
from PIL import Image

from extraction.image_pdf_extractor import ImagePdfExtractor


def make_pil_image():
    return Image.fromarray(np.zeros((10, 10, 3), dtype=np.uint8))


def _box(x0, y0, x1, y1, text):
    return ([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], text, 0.9)


def test_extract_single_page_returns_list():
    mock_reader = MagicMock()
    mock_reader.readtext.return_value = [_box(10, 10, 120, 30, "Scanned text")]

    extractor = ImagePdfExtractor(gpu=False, reader=mock_reader)

    with patch("extraction.image_pdf_extractor.convert_from_path") as mock_convert:
        mock_convert.return_value = [make_pil_image()]
        result = extractor.extract("scanned.pdf")

    assert result == ["Scanned text"]
    # New behaviour: OCR runs with bounding boxes for layout reconstruction.
    _, kwargs = mock_reader.readtext.call_args
    assert kwargs.get("detail") == 1 and kwargs.get("paragraph") is False


def test_extract_multi_page_returns_one_element_per_page():
    mock_reader = MagicMock()
    mock_reader.readtext.side_effect = [
        [_box(10, 10, 120, 30, "Page 1 text")],
        [_box(10, 10, 120, 30, "Page 2 text")],
    ]

    extractor = ImagePdfExtractor(gpu=False, reader=mock_reader)

    with patch("extraction.image_pdf_extractor.convert_from_path") as mock_convert:
        mock_convert.return_value = [make_pil_image(), make_pil_image()]
        result = extractor.extract("scanned.pdf")

    assert result == ["Page 1 text", "Page 2 text"]
