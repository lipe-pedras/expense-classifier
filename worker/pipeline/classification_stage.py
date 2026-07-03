from entities.classification_result import ClassificationResult
from entities.document_context import DocumentContext
from classification.llm_classifier import LlmClassifier
from pipeline.pipeline_stage import PipelineStage


class ClassificationStage(PipelineStage):
    """
    Calls the LLM classifier for each page segment.

    Each call returns a list of expenses found on that page. The results
    are flattened into a single list and stored as ``ctx._classification_results``
    so the subsequent postprocessing and persistence stages can access them.
    """

    def __init__(self, classifier: LlmClassifier) -> None:
        self._classifier = classifier

    def process(self, ctx: DocumentContext) -> None:
        results: list[ClassificationResult] = []
        for seg in ctx.segments:
            text = seg.normalised_text or seg.raw_text
            page_results = self._classifier.classify(seg.index, text, ctx.categories)
            results.extend(page_results)
        ctx._classification_results = results  # type: ignore[attr-defined]
