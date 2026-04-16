from entities.document_context import DocumentContext
from pipeline.pipeline_stage import PipelineStage
from segmentation.expense_segmenter import segment


class SegmentationStage(PipelineStage):
    """Splits ctx.raw_text into individual DocumentSegments."""

    def process(self, ctx: DocumentContext) -> None:
        segment(ctx)
