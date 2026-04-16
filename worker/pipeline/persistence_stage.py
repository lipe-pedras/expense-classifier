from entities.document_context import DocumentContext
from api_client.internal_api_client import InternalApiClient
from pipeline.pipeline_stage import PipelineStage


class PersistenceStage(PipelineStage):
    """
    POSTs each ClassificationResult to the API's internal endpoint.

    The API records the expense, increments the document's expense counter,
    and updates the document status to COMPLETED via its own event bus once
    the BullMQ job finishes.
    """

    def __init__(self, api_client: InternalApiClient) -> None:
        self._client = api_client

    def process(self, ctx: DocumentContext) -> None:
        results = getattr(ctx, "_classification_results", [])
        for result in results:
            self._client.post_result(ctx.document_id, ctx.user_id, result)
