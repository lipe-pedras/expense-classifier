from unittest.mock import MagicMock, patch

from extraction.text_pdf_extractor import TextPdfExtractor


def _mock_pdf(pages_text: list[str]):
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


def test_single_page_pdf_returns_list_with_one_element():
    with patch("extraction.text_pdf_extractor.pdfplumber.open") as mock_open:
        mock_open.return_value = _mock_pdf(["Page one text"])
        extractor = TextPdfExtractor()
        result = extractor.extract("fake.pdf")
    assert result == ["Page one text"]


def test_multi_page_pdf_returns_one_element_per_page():
    with patch("extraction.text_pdf_extractor.pdfplumber.open") as mock_open:
        mock_open.return_value = _mock_pdf(["Page 1", "Page 2"])
        extractor = TextPdfExtractor()
        result = extractor.extract("fake.pdf")
    assert result == ["Page 1", "Page 2"]


def test_none_page_text_treated_as_empty():
    with patch("extraction.text_pdf_extractor.pdfplumber.open") as mock_open:
        mock_open.return_value = _mock_pdf([None, "Page 2"])
        extractor = TextPdfExtractor()
        result = extractor.extract("fake.pdf")
    assert result == ["", "Page 2"]
