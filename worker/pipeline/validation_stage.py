from entities.document_context import DocumentContext
from pipeline.pipeline_stage import PipelineStage


class ValidationError(Exception):
    """Raised when a context is too broken to process."""


class ValidationStage(PipelineStage):
    """
    Aborts the pipeline when the document cannot be processed:

    - No raw text extracted
    - No segments produced
    - Accumulated errors in ctx.errors
    """

    def process(self, ctx: DocumentContext) -> None:
        if ctx.errors:
            raise ValidationError("; ".join(ctx.errors))

        if not ctx.raw_text.strip():
            raise ValidationError("No text could be extracted from the document")

        if not ctx.segments:
            raise ValidationError("Document produced no segments after extraction")
