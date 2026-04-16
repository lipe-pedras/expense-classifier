from extraction.interfaces.i_extraction_strategy import IExtractionStrategy
from extraction.text_pdf_extractor import TextPdfExtractor
from extraction.image_pdf_extractor import ImagePdfExtractor
from extraction.image_extractor import ImageExtractor
from extraction.pdf_type_detector import is_text_pdf


class ExtractionStrategyFactory:
    """
    Selects the correct IExtractionStrategy for a given file.

    Decision tree:
      IMAGE  → ImageExtractor
      PDF    → is_text_pdf()?  TextPdfExtractor  :  ImagePdfExtractor
    """

    def __init__(self, gpu: bool = True) -> None:
        self._gpu = gpu
        self._image_extractor: ImageExtractor | None = None
        self._image_pdf_extractor: ImagePdfExtractor | None = None

    def get_strategy(self, file_path: str, file_type: str) -> IExtractionStrategy:
        if file_type == "IMAGE":
            return self._get_image_extractor()

        # file_type == "PDF"
        if is_text_pdf(file_path):
            return TextPdfExtractor()
        return self._get_image_pdf_extractor()

    # ---- lazy singletons (EasyOCR is expensive to initialise) ----

    def _get_image_extractor(self) -> ImageExtractor:
        if self._image_extractor is None:
            self._image_extractor = ImageExtractor(gpu=self._gpu)
        return self._image_extractor

    def _get_image_pdf_extractor(self) -> ImagePdfExtractor:
        if self._image_pdf_extractor is None:
            self._image_pdf_extractor = ImagePdfExtractor(gpu=self._gpu)
        return self._image_pdf_extractor
