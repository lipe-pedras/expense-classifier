from typing import Optional

import easyocr
import numpy as np
from pdf2image import convert_from_path

from extraction.interfaces.i_extraction_strategy import IExtractionStrategy
from extraction.ocr_layout import ocr_image


class ImagePdfExtractor(IExtractionStrategy):
    """
    Extracts text from a scanned (image-only) PDF.

    Each page is rasterised with pdf2image (wraps poppler) at 200 DPI, then
    passed to EasyOCR.
    """

    DPI = 200

    def __init__(self, gpu: bool = True, reader: Optional[easyocr.Reader] = None) -> None:
        self._reader = reader or easyocr.Reader(["en", "pt"], gpu=gpu)

    def extract(self, file_path: str) -> list[str]:
        images = convert_from_path(file_path, dpi=self.DPI)
        pages: list[str] = []
        for pil_image in images:
            arr = np.array(pil_image.convert("RGB"))
            # Coordinate-based row reconstruction preserves table layout so the
            # LLM can pair each line-item description with its amount.
            pages.append(ocr_image(self._reader, arr))
        return pages
