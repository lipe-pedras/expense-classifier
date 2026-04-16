from typing import Optional

import easyocr
import numpy as np
from PIL import Image

from extraction.interfaces.i_extraction_strategy import IExtractionStrategy


class ImageExtractor(IExtractionStrategy):
    """
    Extracts text from a raster image (JPEG/PNG/WEBP) via EasyOCR.

    The reader is instantiated once and reused for the lifetime of this object.
    Pass ``gpu=False`` in tests or CPU-only environments.
    """

    def __init__(self, gpu: bool = True, reader: Optional[easyocr.Reader] = None) -> None:
        # Allow injecting a pre-built reader for testing
        self._reader = reader or easyocr.Reader(["en", "pt"], gpu=gpu)

    def extract(self, file_path: str) -> str:
        image = np.array(Image.open(file_path).convert("RGB"))
        results = self._reader.readtext(image, detail=0, paragraph=True)
        return "\n".join(results)
