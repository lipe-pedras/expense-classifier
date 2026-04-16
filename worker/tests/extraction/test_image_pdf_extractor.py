from unittest.mock import MagicMock, patch

import numpy as np
from PIL import Image

from extraction.image_pdf_extractor import ImagePdfExtractor


def make_pil_image():
    return Image.fromarray(np.zeros((10, 10, 3), dtype=np.uint8))


def test_extract_single_page():
    mock_reader = MagicMock()
    mock_reader.readtext.return_value = ["Scanned text"]

    extractor = ImagePdfExtractor(gpu=False, reader=mock_reader)

    with patch("extraction.image_pdf_extractor.convert_from_path") as mock_convert:
        mock_convert.return_value = [make_pil_image()]
        result = extractor.extract("scanned.pdf")

    assert result == "Scanned text"


def test_extract_multi_page_joined():
    mock_reader = MagicMock()
    mock_reader.readtext.side_effect = [["Page 1 text"], ["Page 2 text"]]

    extractor = ImagePdfExtractor(gpu=False, reader=mock_reader)

    with patch("extraction.image_pdf_extractor.convert_from_path") as mock_convert:
        mock_convert.return_value = [make_pil_image(), make_pil_image()]
        result = extractor.extract("scanned.pdf")

    assert "Page 1 text" in result
    assert "Page 2 text" in result
    assert result.count("\n\n") == 1
