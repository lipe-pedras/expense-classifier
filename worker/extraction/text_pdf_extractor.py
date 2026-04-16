import pdfplumber

from extraction.interfaces.i_extraction_strategy import IExtractionStrategy


class TextPdfExtractor(IExtractionStrategy):
    """Extracts text from a native (text-layer) PDF using pdfplumber."""

    def extract(self, file_path: str) -> list[str]:
        with pdfplumber.open(file_path) as pdf:
            return [page.extract_text() or "" for page in pdf.pages]
