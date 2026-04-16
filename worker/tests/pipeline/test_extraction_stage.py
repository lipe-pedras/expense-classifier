from unittest.mock import MagicMock

from entities.document_context import DocumentContext
from extraction.extraction_strategy_factory import ExtractionStrategyFactory
from pipeline.extraction_stage import ExtractionStage


def test_extraction_stage_sets_raw_pages_and_raw_text():
    mock_strategy = MagicMock()
    mock_strategy.extract.return_value = ["page one", "page two"]

    mock_factory = MagicMock(spec=ExtractionStrategyFactory)
    mock_factory.get_strategy.return_value = mock_strategy

    ctx = DocumentContext("doc-1", "user-1", "/uploads/test.pdf", "PDF")
    stage = ExtractionStage(mock_factory)
    stage.process(ctx)

    assert ctx.raw_pages == ["page one", "page two"]
    assert ctx.raw_text == "page one\n\npage two"
    mock_factory.get_strategy.assert_called_once_with("/uploads/test.pdf", "PDF")
    mock_strategy.extract.assert_called_once_with("/uploads/test.pdf")


def test_extraction_stage_single_page():
    mock_strategy = MagicMock()
    mock_strategy.extract.return_value = ["extracted text"]

    mock_factory = MagicMock(spec=ExtractionStrategyFactory)
    mock_factory.get_strategy.return_value = mock_strategy

    ctx = DocumentContext("doc-1", "user-1", "/uploads/test.pdf", "PDF")
    ExtractionStage(mock_factory).process(ctx)

    assert ctx.raw_pages == ["extracted text"]
    assert ctx.raw_text == "extracted text"


def test_extraction_stage_passes_image_type():
    mock_strategy = MagicMock()
    mock_strategy.extract.return_value = ["image text"]

    mock_factory = MagicMock(spec=ExtractionStrategyFactory)
    mock_factory.get_strategy.return_value = mock_strategy

    ctx = DocumentContext("doc-1", "user-1", "/uploads/photo.jpg", "IMAGE")
    ExtractionStage(mock_factory).process(ctx)

    mock_factory.get_strategy.assert_called_once_with("/uploads/photo.jpg", "IMAGE")
