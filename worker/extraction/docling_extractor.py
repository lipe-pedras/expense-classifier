from typing import Any, Optional

from extraction.interfaces.i_extraction_strategy import IExtractionStrategy


class DoclingExtractor(IExtractionStrategy):
    """
    Extracts text from PDFs and images using Docling.

    Runs on the CPU by default (``device="cpu"``). It can be pointed at the GPU
    with ``device="cuda"``, but note Docling's layout/table/OCR models may exceed
    a GPU that is already largely occupied (e.g. by Ollama). The converter is
    expensive to build, so a single instance is reused for the lifetime of this
    object (the factory holds it as a lazy singleton).

    A pre-built ``converter`` may be injected for testing to avoid loading models.
    """

    def __init__(self, device: str = "cpu", converter: Optional[Any] = None) -> None:
        self._device = device
        self._converter = converter if converter is not None else self._build_converter()

    def _build_converter(self) -> Any:
        from docling.datamodel.base_models import InputFormat
        from docling.datamodel.pipeline_options import (
            AcceleratorDevice,
            AcceleratorOptions,
            PdfPipelineOptions,
        )
        from docling.document_converter import DocumentConverter, PdfFormatOption

        device = (
            AcceleratorDevice.CUDA
            if self._device == "cuda"
            else AcceleratorDevice.CPU
        )
        pipeline_options = PdfPipelineOptions()
        pipeline_options.accelerator_options = AcceleratorOptions(device=device)
        # Images are handled by the same PDF pipeline (treated as single-page docs),
        # so the CPU-bound options apply to both formats.
        pdf_option = PdfFormatOption(pipeline_options=pipeline_options)
        return DocumentConverter(
            format_options={
                InputFormat.PDF: pdf_option,
                InputFormat.IMAGE: pdf_option,
            },
        )

    def extract(self, file_path: str) -> list[str]:
        result = self._converter.convert(file_path)
        document = result.document
        pages = self._text_by_page(document)
        if pages:
            return pages
        # Fallback: no page provenance available — return the whole document as one page.
        return [document.export_to_markdown()]

    @staticmethod
    def _text_by_page(document: Any) -> list[str]:
        """Group every text item by its source page, preserving page order."""
        page_numbers = sorted(getattr(document, "pages", {}) or {})
        if not page_numbers:
            return []

        buckets: dict[int, list[str]] = {page: [] for page in page_numbers}
        for item, _level in document.iterate_items():
            text = getattr(item, "text", None)
            prov = getattr(item, "prov", None)
            if not text or not prov:
                continue
            page_no = getattr(prov[0], "page_no", None)
            if page_no in buckets:
                buckets[page_no].append(text)

        return ["\n".join(buckets[page]) for page in page_numbers]
