from unittest.mock import MagicMock, patch

import pytest

from extraction.pdf_type_detector import is_text_pdf


def _mock_pdf(pages_text: list[str]):
    """Return a pdfplumber context manager mock with given page texts."""
    pages = []
    for text in pages_text:
        page = MagicMock()
        page.extract_text.return_value = text
        pages.append(page)
    pdf = MagicMock()
    pdf.pages = pages
    cm = MagicMock()
    cm.__enter__ = MagicMock(return_value=pdf)
    cm.__exit__ = MagicMock(return_value=False)
    return cm


def test_text_pdf_with_sufficient_content(tmp_path):
    with patch("extraction.pdf_type_detector.pdfplumber.open") as mock_open:
        mock_open.return_value = _mock_pdf(["This is a long enough text segment on the page."])
        assert is_text_pdf("fake.pdf") is True


def test_scanned_pdf_with_no_text(tmp_path):
    with patch("extraction.pdf_type_detector.pdfplumber.open") as mock_open:
        mock_open.return_value = _mock_pdf([""])
        assert is_text_pdf("fake.pdf") is False


def test_empty_pdf_returns_false():
    with patch("extraction.pdf_type_detector.pdfplumber.open") as mock_open:
        pdf = MagicMock()
        pdf.pages = []
        cm = MagicMock()
        cm.__enter__ = MagicMock(return_value=pdf)
        cm.__exit__ = MagicMock(return_value=False)
        mock_open.return_value = cm
        assert is_text_pdf("fake.pdf") is False


def test_multipage_average_below_threshold():
    # 2 pages: 5 chars + 5 chars = avg 5, below threshold of 20
    with patch("extraction.pdf_type_detector.pdfplumber.open") as mock_open:
        mock_open.return_value = _mock_pdf(["hello", "world"])
        assert is_text_pdf("fake.pdf") is False
