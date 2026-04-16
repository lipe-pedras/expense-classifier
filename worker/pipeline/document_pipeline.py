from entities.document_context import DocumentContext
from pipeline.pipeline_stage import PipelineStage


class DocumentPipeline:
    """
    Executes a list of PipelineStage objects in order (chain of responsibility).

    If any stage raises, the exception propagates to the caller (the BullMQ
    job handler), which marks the job as failed.
    """

    def __init__(self, stages: list[PipelineStage]) -> None:
        self._stages = stages

    def run(self, ctx: DocumentContext) -> None:
        for stage in self._stages:
            stage.process(ctx)
