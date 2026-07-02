import pymupdf4llm

from extraction.interfaces.i_extraction_strategy import IExtractionStrategy


class PyMuPdf4LlmExtractor(IExtractionStrategy):
    """
    Extracts per-page Markdown from a text-native PDF using pymupdf4llm.

    Pure-Python (PyMuPDF) with no ML models, so it is far faster and lighter than
    Docling. It only reads an existing text layer — scanned/image PDFs and image
    files should be routed to an OCR fallback by the factory.
    """

    def extract(self, file_path: str) -> list[str]:
        # page_chunks=True yields one dict per page, each with a "text" (markdown) field.
        chunks = pymupdf4llm.to_markdown(file_path, page_chunks=True)
        return [chunk.get("text", "") for chunk in chunks]
