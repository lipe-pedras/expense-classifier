import json
import re
import textwrap

import httpx

_FENCE = re.compile(r"^```(?:json)?|```$", re.MULTILINE)


def _build_system_prompt(allowed: dict) -> str:
    metrics = " | ".join(allowed.get("metric", []))
    groups = " | ".join(allowed.get("groupBy", []))
    ranges = " | ".join(allowed.get("dateRange", []))
    charts = " | ".join(allowed.get("chart", []))
    return textwrap.dedent("""\
        You translate a user's request into a chart specification for their own
        expense data. Respond ONLY with a JSON object — no markdown, no prose.

        Schema:
        {{
          "metric": "<one of: {metrics}>",
          "groupBy": "<one of: {groups}>",
          "dateRange": "<one of: {ranges}>",
          "chart": "<one of: {charts}>"
        }}

        Meaning:
        - metric: sum_amount = total spent, count = number of expenses, avg_amount = average expense.
        - groupBy: what each bar/slice represents.
        - dateRange: the time window; use "all" when the user gives no period.
        - chart: the visualization type; pick the most suitable if unspecified.

        Rules:
        - Every field is required and MUST be exactly one of the listed values.
        - If the request is not about charting expenses, or cannot be expressed
          with these options, respond with exactly: {{"unsupported": true}}
    """).format(metrics=metrics, groups=groups, ranges=ranges, charts=charts)


class ChartSpecGenerator:
    """Asks the local Ollama instance to map a prompt to a whitelisted chart spec.

    The model never sees or touches expense data — it only emits a JSON spec that
    the API validates and compiles. On any parsing trouble we return an
    ``unsupported`` marker so the API can respond with a friendly error.
    """

    def __init__(self, base_url: str, model: str, client: httpx.Client | None = None) -> None:
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._client = client or httpx.Client(timeout=120)

    def generate(self, prompt: str, allowed: dict) -> dict:
        payload = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": _build_system_prompt(allowed)},
                {"role": "user", "content": prompt},
            ],
            "stream": False,
        }
        response = self._client.post(f"{self._base_url}/api/chat", json=payload)
        response.raise_for_status()
        content: str = response.json()["message"]["content"]
        return self._parse(content)

    def _parse(self, content: str) -> dict:
        cleaned = _FENCE.sub("", content).strip()
        try:
            data = json.loads(cleaned)
        except json.JSONDecodeError:
            return {"unsupported": True}
        if not isinstance(data, dict):
            return {"unsupported": True}
        return data
