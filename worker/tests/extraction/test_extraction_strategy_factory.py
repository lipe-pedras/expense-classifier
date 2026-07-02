from unittest.mock import patch

from extraction.extraction_strategy_factory import ExtractionStrategyFactory
from extraction.text_pdf_extractor import TextPdfExtractor
from extraction.image_pdf_extractor import ImagePdfExtractor
from extraction.image_extractor import ImageExtractor


def test_default_image_type_returns_docling():
    factory = ExtractionStrategyFactory(gpu=False)
    with patch.object(factory, "_get_docling_extractor") as mock:
        factory.get_strategy("/a/b.jpg", "IMAGE")
        mock.assert_called_once()


def test_text_pdf_returns_text_extractor():
    factory = ExtractionStrategyFactory(gpu=False)
    with patch("extraction.extraction_strategy_factory.is_text_pdf", return_value=True):
        strategy = factory.get_strategy("/a/b.pdf", "PDF")
    assert isinstance(strategy, TextPdfExtractor)


def test_default_scanned_pdf_returns_docling():
    factory = ExtractionStrategyFactory(gpu=False)
    with patch("extraction.extraction_strategy_factory.is_text_pdf", return_value=False):
        with patch.object(factory, "_get_docling_extractor") as mock:
            factory.get_strategy("/a/b.pdf", "PDF")
            mock.assert_called_once()


def test_image_extractor_is_reused():
    """EasyOCR is expensive — the factory must cache the extractor."""
    factory = ExtractionStrategyFactory(gpu=False)
    with patch("extraction.extraction_strategy_factory.is_text_pdf", return_value=False):
        e1 = factory._get_image_extractor()
        e2 = factory._get_image_extractor()
    assert e1 is e2


def test_docling_engine_returns_docling_for_pdf_and_image():
    factory = ExtractionStrategyFactory(gpu=False, engine="docling")
    with patch.object(factory, "_get_docling_extractor") as mock:
        factory.get_strategy("/a/b.pdf", "PDF")
        factory.get_strategy("/a/b.jpg", "IMAGE")
    assert mock.call_count == 2


def test_docling_extractor_is_reused():
    """The Docling converter is expensive — the factory must cache it."""
    factory = ExtractionStrategyFactory(gpu=False, engine="docling")
    sentinel = object()
    with patch("extraction.docling_extractor.DoclingExtractor", return_value=sentinel) as ctor:
        d1 = factory._get_docling_extractor()
        d2 = factory._get_docling_extractor()
    assert d1 is d2
    ctor.assert_called_once()


def test_docling_device_is_passed_through():
    factory = ExtractionStrategyFactory(gpu=False, engine="docling", docling_device="cuda")
    with patch("extraction.docling_extractor.DoclingExtractor") as ctor:
        factory._get_docling_extractor()
    ctor.assert_called_once_with(device="cuda")


def test_pymupdf4llm_engine_uses_pymupdf4llm_for_text_pdf():
    factory = ExtractionStrategyFactory(gpu=False, engine="pymupdf4llm")
    with patch("extraction.extraction_strategy_factory.is_text_pdf", return_value=True):
        with patch.object(factory, "_get_pymupdf4llm_extractor") as mock:
            factory.get_strategy("/a/b.pdf", "PDF")
            mock.assert_called_once()


def test_pymupdf4llm_engine_falls_back_to_easyocr_for_scanned_pdf():
    factory = ExtractionStrategyFactory(gpu=False, engine="pymupdf4llm", fallback="easyocr")
    with patch("extraction.extraction_strategy_factory.is_text_pdf", return_value=False):
        with patch.object(factory, "_get_image_pdf_extractor") as mock:
            factory.get_strategy("/a/b.pdf", "PDF")
            mock.assert_called_once()


def test_pymupdf4llm_engine_falls_back_to_easyocr_for_image():
    factory = ExtractionStrategyFactory(gpu=False, engine="pymupdf4llm", fallback="easyocr")
    with patch.object(factory, "_get_image_extractor") as mock:
        factory.get_strategy("/a/b.jpg", "IMAGE")
        mock.assert_called_once()


def test_pymupdf4llm_engine_can_fall_back_to_docling():
    factory = ExtractionStrategyFactory(gpu=False, engine="pymupdf4llm", fallback="docling")
    with patch.object(factory, "_get_docling_extractor") as mock:
        factory.get_strategy("/a/b.jpg", "IMAGE")
        mock.assert_called_once()


def test_pymupdf4llm_extractor_is_reused():
    factory = ExtractionStrategyFactory(gpu=False, engine="pymupdf4llm")
    sentinel = object()
    with patch(
        "extraction.pymupdf4llm_extractor.PyMuPdf4LlmExtractor", return_value=sentinel
    ) as ctor:
        p1 = factory._get_pymupdf4llm_extractor()
        p2 = factory._get_pymupdf4llm_extractor()
    assert p1 is p2
    ctor.assert_called_once()
