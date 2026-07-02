from unittest.mock import patch

from extraction.pymupdf4llm_extractor import PyMuPdf4LlmExtractor
from extraction.interfaces.i_extraction_strategy import IExtractionStrategy


def test_is_extraction_strategy():
    assert isinstance(PyMuPdf4LlmExtractor(), IExtractionStrategy)


def test_extract_returns_one_markdown_string_per_page():
    chunks = [
        {"text": "# Page one\nTotal 10", "metadata": {}},
        {"text": "# Page two\nTotal 20", "metadata": {}},
    ]
    with patch(
        "extraction.pymupdf4llm_extractor.pymupdf4llm.to_markdown", return_value=chunks
    ) as to_md:
        pages = PyMuPdf4LlmExtractor().extract("/a/b.pdf")

    to_md.assert_called_once_with("/a/b.pdf", page_chunks=True)
    assert pages == ["# Page one\nTotal 10", "# Page two\nTotal 20"]


def test_extract_handles_pages_without_text():
    chunks = [{"metadata": {}}, {"text": "content"}]
    with patch(
        "extraction.pymupdf4llm_extractor.pymupdf4llm.to_markdown", return_value=chunks
    ):
        pages = PyMuPdf4LlmExtractor().extract("/a/b.pdf")

    assert pages == ["", "content"]
