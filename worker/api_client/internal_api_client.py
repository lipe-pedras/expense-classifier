import httpx

from entities.classification_result import ClassificationResult


class InternalApiClient:
    """
    Thin HTTP wrapper around the API's ``POST /internal/results`` endpoint.
    Called once per classified segment to persist the expense.
    """

    def __init__(self, base_url: str, token: str, client: httpx.Client | None = None) -> None:
        self._base_url = base_url.rstrip("/")
        self._token = token
        self._client = client or httpx.Client(timeout=30)

    def reset_document(self, document_id: str) -> None:
        """
        Clear any expenses left over from a previous run of this document before
        persisting a fresh batch. Makes (re)processing idempotent so a stalled-and-
        reprocessed job replaces its expenses instead of duplicating them.
        """
        response = self._client.post(
            f"{self._base_url}/internal/documents/{document_id}/reset",
            headers={"Authorization": f"Bearer {self._token}"},
        )
        response.raise_for_status()

    def post_result(
        self,
        document_id: str,
        user_id: str,
        result: ClassificationResult,
    ) -> None:
        payload = {
            "documentId": document_id,
            "segmentIndex": result.segment_index,
            "categorySlug": result.category_slug,
            "vendor": result.vendor,
            "amount": result.amount,
            "currency": result.currency,
            "expenseDate": result.expense_date.isoformat(),
            "confidence": result.confidence,
            "rawText": result.raw_text,
        }
        response = self._client.post(
            f"{self._base_url}/internal/results",
            json=payload,
            headers={"Authorization": f"Bearer {self._token}"},
        )
        response.raise_for_status()
