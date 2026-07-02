from extraction.interfaces.i_extraction_strategy import IExtractionStrategy
from extraction.text_pdf_extractor import TextPdfExtractor
from extraction.image_pdf_extractor import ImagePdfExtractor
from extraction.image_extractor import ImageExtractor
from extraction.pdf_type_detector import is_text_pdf


class ExtractionStrategyFactory:
    """
    Selects the correct IExtractionStrategy for a given file.

    Decision tree by ``engine``:
      docling      → DoclingExtractor (both IMAGE and PDF)
      pymupdf4llm  → PyMuPdf4LlmExtractor for text PDFs; IMAGE and scanned PDFs
                     go to the configured ``fallback`` (docling | easyocr)
      default      → text PDF → TextPdfExtractor (pdfplumber);
                     IMAGE and scanned PDFs → DoclingExtractor (layout-aware OCR)

    EasyOCR extractors remain available for the ``pymupdf4llm`` engine's
    ``fallback="easyocr"`` option.
    """

    def __init__(
        self,
        gpu: bool = True,
        engine: str = "default",
        fallback: str = "docling",
        docling_device: str = "cpu",
    ) -> None:
        self._gpu = gpu
        self._engine = engine
        self._fallback = fallback
        self._docling_device = docling_device
        self._image_extractor: ImageExtractor | None = None
        self._image_pdf_extractor: ImagePdfExtractor | None = None
        self._docling_extractor: IExtractionStrategy | None = None
        self._pymupdf4llm_extractor: IExtractionStrategy | None = None

    def get_strategy(self, file_path: str, file_type: str) -> IExtractionStrategy:
        if self._engine == "docling":
            return self._get_docling_extractor()

        if self._engine == "pymupdf4llm":
            # pymupdf4llm only reads a text layer — OCR cases go to the fallback.
            if file_type == "PDF" and is_text_pdf(file_path):
                return self._get_pymupdf4llm_extractor()
            return self._get_fallback_strategy(file_type)

        # engine == "default": pdfplumber for text PDFs, Docling for OCR cases.
        if file_type == "PDF" and is_text_pdf(file_path):
            return TextPdfExtractor()
        return self._get_docling_extractor()

    def _get_fallback_strategy(self, file_type: str) -> IExtractionStrategy:
        if self._fallback == "docling":
            return self._get_docling_extractor()
        # easyocr
        if file_type == "IMAGE":
            return self._get_image_extractor()
        return self._get_image_pdf_extractor()

    # ---- lazy singletons (extractor models are expensive to initialise) ----

    def _get_docling_extractor(self) -> IExtractionStrategy:
        if self._docling_extractor is None:
            # Imported lazily so the docling dependency is only loaded when enabled.
            from extraction.docling_extractor import DoclingExtractor

            self._docling_extractor = DoclingExtractor(device=self._docling_device)
        return self._docling_extractor

    def _get_pymupdf4llm_extractor(self) -> IExtractionStrategy:
        if self._pymupdf4llm_extractor is None:
            # Imported lazily so the dependency is only loaded when enabled.
            from extraction.pymupdf4llm_extractor import PyMuPdf4LlmExtractor

            self._pymupdf4llm_extractor = PyMuPdf4LlmExtractor()
        return self._pymupdf4llm_extractor

    def _get_image_extractor(self) -> ImageExtractor:
        if self._image_extractor is None:
            self._image_extractor = ImageExtractor(gpu=self._gpu)
        return self._image_extractor

    def _get_image_pdf_extractor(self) -> ImagePdfExtractor:
        if self._image_pdf_extractor is None:
            self._image_pdf_extractor = ImagePdfExtractor(gpu=self._gpu)
        return self._image_pdf_extractor
