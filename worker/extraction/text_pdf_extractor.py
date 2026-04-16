import pdfplumber

from extraction.interfaces.i_extraction_strategy import IExtractionStrategy


class TextPdfExtractor(IExtractionStrategy):
    """Extracts text from a native (text-layer) PDF using pdfplumber."""

    def extract(self, file_path: str) -> str:
        pages: list[str] = []
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text() or ""
                pages.append(text)
        return "\n\n".join(pages)
