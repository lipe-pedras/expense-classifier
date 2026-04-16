from entities.document_context import DocumentContext
from pipeline.pipeline_stage import PipelineStage
from postprocessing.llm_output_fixer import fix


class PostprocessingStage(PipelineStage):
    """Applies heuristic corrections to every ClassificationResult."""

    def process(self, ctx: DocumentContext) -> None:
        raw: list = getattr(ctx, "_classification_results", [])
        ctx._classification_results = [fix(r) for r in raw]  # type: ignore[attr-defined]
