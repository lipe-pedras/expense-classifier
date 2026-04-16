from entities.document_context import DocumentContext
from pipeline.pipeline_stage import PipelineStage
from preprocessing.text_normaliser import normalise


class PreprocessingStage(PipelineStage):
    """Normalises the text of every segment in ctx.segments."""

    def process(self, ctx: DocumentContext) -> None:
        for seg in ctx.segments:
            seg.normalised_text = normalise(seg.raw_text)
