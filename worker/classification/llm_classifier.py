import json
import textwrap
from datetime import date

import httpx

from entities.classification_result import ClassificationResult

_VALID_SLUGS = {"rent", "water", "electricity", "internet", "insurance", "other"}

_SYSTEM_PROMPT = textwrap.dedent("""\
    You are a financial document classifier. Given a text segment from a bill or receipt,
    extract the following fields and respond ONLY with valid JSON — no markdown, no explanation.

    JSON schema:
    {
      "category_slug": "<one of: rent | water | electricity | internet | insurance | other>",
      "vendor": "<company name or null>",
      "amount": <number>,
      "currency": "<ISO 4217 code, e.g. BRL or USD>",
      "expense_date": "<YYYY-MM-DD>",
      "confidence": <float between 0 and 1>
    }

    Rules:
    - If you cannot determine a field, use null for strings and 0 for numbers.
    - expense_date must be the date the expense was incurred, not today's date.
    - confidence reflects how certain you are about the classification (1 = certain).
""")


class LlmClassifier:
    """Calls the local Ollama instance to classify a single text segment."""

    def __init__(self, base_url: str, model: str, client: httpx.Client | None = None) -> None:
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._client = client or httpx.Client(timeout=120)

    def classify(self, segment_index: int, text: str) -> ClassificationResult:
        payload = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": text},
            ],
            "stream": False,
        }
        response = self._client.post(
            f"{self._base_url}/api/chat",
            json=payload,
        )
        response.raise_for_status()
        raw_content: str = response.json()["message"]["content"]
        return self._parse(segment_index, text, raw_content)

    def _parse(self, segment_index: int, raw_text: str, content: str) -> ClassificationResult:
        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            # Return a low-confidence fallback rather than crashing
            return ClassificationResult(
                segment_index=segment_index,
                category_slug="other",
                vendor=None,
                amount=0.0,
                currency="BRL",
                expense_date=date.today(),
                confidence=0.0,
                raw_text=raw_text,
            )

        category_slug = data.get("category_slug", "other")
        if category_slug not in _VALID_SLUGS:
            category_slug = "other"

        try:
            expense_date = date.fromisoformat(str(data.get("expense_date", "")))
        except ValueError:
            expense_date = date.today()

        return ClassificationResult(
            segment_index=segment_index,
            category_slug=category_slug,
            vendor=data.get("vendor") or None,
            amount=float(data.get("amount") or 0),
            currency=str(data.get("currency") or "BRL").upper(),
            expense_date=expense_date,
            confidence=min(1.0, max(0.0, float(data.get("confidence") or 0))),
            raw_text=raw_text,
        )
