from entities.document_context import DocumentContext
from extraction.extraction_strategy_factory import ExtractionStrategyFactory
from pipeline.pipeline_stage import PipelineStage


class ExtractionStage(PipelineStage):
    """Extracts raw text from the file and stores it in ctx.raw_text."""

    def __init__(self, factory: ExtractionStrategyFactory) -> None:
        self._factory = factory

    def process(self, ctx: DocumentContext) -> None:
        strategy = self._factory.get_strategy(ctx.file_path, ctx.file_type)
        ctx.raw_text = strategy.extract(ctx.file_path)
