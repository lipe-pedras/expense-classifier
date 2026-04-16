from unittest.mock import MagicMock, patch

import numpy as np
import pytest

from extraction.image_extractor import ImageExtractor


def test_extract_returns_list_with_joined_lines(tmp_path):
    img_path = tmp_path / "test.png"

    mock_reader = MagicMock()
    mock_reader.readtext.return_value = ["Line one", "Line two"]

    extractor = ImageExtractor(gpu=False, reader=mock_reader)

    with patch("extraction.image_extractor.Image") as mock_pil:
        mock_img = MagicMock()
        mock_img.convert.return_value = mock_img
        mock_pil.open.return_value = mock_img
        with patch("extraction.image_extractor.np.array") as mock_np:
            mock_np.return_value = np.zeros((10, 10, 3), dtype=np.uint8)
            result = extractor.extract(str(img_path))

    assert result == ["Line one\nLine two"]
    mock_reader.readtext.assert_called_once()


def test_extract_empty_result_returns_list_with_empty_string(tmp_path):
    mock_reader = MagicMock()
    mock_reader.readtext.return_value = []

    extractor = ImageExtractor(gpu=False, reader=mock_reader)

    with patch("extraction.image_extractor.Image") as mock_pil, \
         patch("extraction.image_extractor.np.array") as mock_np:
        mock_img = MagicMock()
        mock_img.convert.return_value = mock_img
        mock_pil.open.return_value = mock_img
        mock_np.return_value = np.zeros((10, 10, 3), dtype=np.uint8)
        result = extractor.extract(str(tmp_path / "empty.jpg"))

    assert result == [""]
