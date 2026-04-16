from entities.document_context import DocumentContext
from pipeline.pipeline_stage import PipelineStage
from postprocessing.llm_output_fixer import fix, deduplicate


class PostprocessingStage(PipelineStage):
    """Applies heuristic corrections and deduplication to every ClassificationResult."""

    def process(self, ctx: DocumentContext) -> None:
        raw: list = getattr(ctx, "_classification_results", [])
        fixed = [fix(r) for r in raw]
        ctx._classification_results = deduplicate(fixed)  # type: ignore[attr-defined]
