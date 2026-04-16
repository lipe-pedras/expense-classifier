from unittest.mock import patch

from extraction.extraction_strategy_factory import ExtractionStrategyFactory
from extraction.text_pdf_extractor import TextPdfExtractor
from extraction.image_pdf_extractor import ImagePdfExtractor
from extraction.image_extractor import ImageExtractor


def test_image_type_returns_image_extractor():
    factory = ExtractionStrategyFactory(gpu=False)
    with patch.object(factory, "_get_image_extractor") as mock:
        factory.get_strategy("/a/b.jpg", "IMAGE")
        mock.assert_called_once()


def test_text_pdf_returns_text_extractor():
    factory = ExtractionStrategyFactory(gpu=False)
    with patch("extraction.extraction_strategy_factory.is_text_pdf", return_value=True):
        strategy = factory.get_strategy("/a/b.pdf", "PDF")
    assert isinstance(strategy, TextPdfExtractor)


def test_scanned_pdf_returns_image_pdf_extractor():
    factory = ExtractionStrategyFactory(gpu=False)
    with patch("extraction.extraction_strategy_factory.is_text_pdf", return_value=False):
        with patch.object(factory, "_get_image_pdf_extractor") as mock:
            factory.get_strategy("/a/b.pdf", "PDF")
            mock.assert_called_once()


def test_image_extractor_is_reused():
    """EasyOCR is expensive — the factory must cache the extractor."""
    factory = ExtractionStrategyFactory(gpu=False)
    with patch("extraction.extraction_strategy_factory.is_text_pdf", return_value=False):
        e1 = factory._get_image_extractor()
        e2 = factory._get_image_extractor()
    assert e1 is e2
