from typing import Optional

import easyocr
import numpy as np
from PIL import Image

from extraction.interfaces.i_extraction_strategy import IExtractionStrategy
from extraction.ocr_layout import ocr_image


class ImageExtractor(IExtractionStrategy):
    """
    Extracts text from a raster image (JPEG/PNG/WEBP) via EasyOCR.

    The reader is instantiated once and reused for the lifetime of this object.
    Pass ``gpu=False`` in tests or CPU-only environments.
    """

    def __init__(self, gpu: bool = True, reader: Optional[easyocr.Reader] = None) -> None:
        # Allow injecting a pre-built reader for testing
        self._reader = reader or easyocr.Reader(["en", "pt"], gpu=gpu)

    def extract(self, file_path: str) -> list[str]:
        image = np.array(Image.open(file_path).convert("RGB"))
        # Coordinate-based row reconstruction preserves table layout so the
        # LLM can pair each line-item description with its amount.
        return [ocr_image(self._reader, image)]
