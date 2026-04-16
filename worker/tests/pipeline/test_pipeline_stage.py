import pytest

from entities.document_context import DocumentContext
from pipeline.pipeline_stage import PipelineStage


class ConcreteStage(PipelineStage):
    def __init__(self):
        self.called = False

    def process(self, ctx: DocumentContext) -> None:
        self.called = True
        ctx.raw_text = "processed"


def test_concrete_stage_can_be_instantiated_and_called():
    ctx = DocumentContext("d", "u", "/f", "PDF")
    stage = ConcreteStage()
    stage.process(ctx)
    assert stage.called
    assert ctx.raw_text == "processed"
