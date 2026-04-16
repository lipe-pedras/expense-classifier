import pytest
from unittest.mock import MagicMock

from entities.document_context import DocumentContext
from pipeline.document_pipeline import DocumentPipeline
from pipeline.pipeline_stage import PipelineStage


def make_ctx():
    return DocumentContext("doc-1", "user-1", "/file.pdf", "PDF")


def test_pipeline_runs_all_stages_in_order():
    order = []

    class StageA(PipelineStage):
        def process(self, ctx):
            order.append("A")

    class StageB(PipelineStage):
        def process(self, ctx):
            order.append("B")

    pipeline = DocumentPipeline([StageA(), StageB()])
    pipeline.run(make_ctx())

    assert order == ["A", "B"]


def test_pipeline_stops_on_stage_exception():
    class FailingStage(PipelineStage):
        def process(self, ctx):
            raise RuntimeError("oops")

    class NeverCalled(PipelineStage):
        def process(self, ctx):
            raise AssertionError("should not be called")

    pipeline = DocumentPipeline([FailingStage(), NeverCalled()])
    with pytest.raises(RuntimeError, match="oops"):
        pipeline.run(make_ctx())


def test_empty_pipeline_runs_without_error():
    pipeline = DocumentPipeline([])
    pipeline.run(make_ctx())  # should not raise
