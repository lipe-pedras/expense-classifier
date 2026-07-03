import json
import re
import textwrap

import httpx

_FENCE = re.compile(r"^```(?:json)?|```$", re.MULTILINE)

# Columns the read-only chart_reader role may read. Kept in sync with the Prisma
# schema; only Expense and Category are exposed (row-level security fences both
# to the requesting user, so the model never needs to filter by user itself).
DEFAULT_SCHEMA = textwrap.dedent("""\
    Table "Expense" (alias e):
      id, "documentId", "userId", "categoryId", amount (numeric),
      currency (text), "expenseDate" (timestamp), vendor (text, nullable),
      confidence (numeric), "rawText" (text), "createdAt" (timestamp)
    Table "Category" (alias c):
      id, "userId", name (text), slug (text), "isSystem" (boolean)
    Join: e."categoryId" = c."id"
    Every row is already restricted to the current user; do NOT filter by userId.""")


def _build_system_prompt(allowed: dict, schema: str, categories: list[dict]) -> str:
    metrics = " | ".join(allowed.get("metric", []))
    groups = " | ".join(allowed.get("groupBy", []))
    ranges = " | ".join(allowed.get("dateRange", []))
    charts = " | ".join(allowed.get("chart", []))
    names = ", ".join(c["name"] for c in categories if c.get("name")) or "(none)"
    return textwrap.dedent("""\
        You translate a user's request into a chart of THEIR OWN expense data.
        Respond ONLY with a single JSON object — no markdown, no prose.

        Choose ONE of three responses:

        1. SIMPLE (preferred when it fits) — a whitelisted spec the server compiles:
        {{
          "mode": "spec",
          "metric": "<one of: {metrics}>",
          "groupBy": "<one of: {groups}>",
          "dateRange": "<one of: {ranges}>",
          "chart": "<one of: {charts}>"
        }}
        - metric: sum_amount = total, count = number of expenses, avg_amount = average.
        - dateRange: use "all" when no period is given.

        2. ADVANCED — a read-only SQL query, for requests the simple spec cannot
           express (filtering to specific categories/vendors, HAVING, top-N, etc.):
        {{
          "mode": "sql",
          "chart": "<one of: {charts}>",
          "sql": "SELECT <label expr> AS label, <numeric expr> AS value FROM ..."
        }}
        SQL rules (MUST follow exactly):
        - A single SELECT statement only. Never INSERT/UPDATE/DELETE/DDL.
        - Project EXACTLY two output columns aliased "label" (text) and "value" (numeric).
        - Use only the tables/columns below. Do NOT filter by userId.
        - Prefer the SIMPLE spec whenever it can express the request.

        3. UNSUPPORTED — if the request is not about charting expenses or cannot be
           expressed at all: {{"unsupported": true}}

        Schema:
        {schema}

        The user's category names: {names}
    """).format(
        metrics=metrics,
        groups=groups,
        ranges=ranges,
        charts=charts,
        schema=schema,
        names=names,
    )


def _build_fix_message(retry: dict) -> str:
    return textwrap.dedent("""\
        Your previous SQL was rejected by the database.

        SQL:
        {sql}

        Error:
        {error}

        Return a corrected response as a single JSON object, following the same
        rules (a read-only SELECT projecting "label" and "value", or switch to
        the simple spec, or {{"unsupported": true}}).
    """).format(sql=retry.get("sql", ""), error=retry.get("error", ""))


class ChartSpecGenerator:
    """Maps a prompt to a chart plan: a whitelisted spec, read-only SQL, or an
    ``unsupported`` marker. The model only emits text — it never sees or touches
    expense data; the API validates and executes whatever it returns.
    """

    def __init__(self, base_url: str, model: str, client: httpx.Client | None = None) -> None:
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._client = client or httpx.Client(timeout=120)

    def generate(
        self,
        prompt: str,
        allowed: dict,
        schema: str | None = None,
        categories: list[dict] | None = None,
        retry: dict | None = None,
    ) -> dict:
        messages = [
            {
                "role": "system",
                "content": _build_system_prompt(allowed, schema or DEFAULT_SCHEMA, categories or []),
            },
            {"role": "user", "content": prompt},
        ]
        if retry:
            messages.append({"role": "user", "content": _build_fix_message(retry)})

        payload = {"model": self._model, "messages": messages, "stream": False}
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
