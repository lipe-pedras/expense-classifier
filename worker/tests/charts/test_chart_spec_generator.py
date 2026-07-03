import json
from unittest.mock import MagicMock

import httpx

from charts.chart_spec_generator import ChartSpecGenerator

ALLOWED = {
    "metric": ["sum_amount", "count", "avg_amount"],
    "groupBy": ["category", "month", "vendor", "currency"],
    "dateRange": ["last_month", "last_3_months", "last_6_months", "last_year", "all"],
    "chart": ["bar", "pie", "line", "table"],
}


def make_client(response_content: str) -> httpx.Client:
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = {"message": {"content": response_content}}
    mock_client = MagicMock(spec=httpx.Client)
    mock_client.post.return_value = mock_response
    return mock_client


def test_generate_returns_parsed_spec():
    spec = {"metric": "sum_amount", "groupBy": "category", "dateRange": "all", "chart": "pie"}
    gen = ChartSpecGenerator("http://ollama:11434", "m", client=make_client(json.dumps(spec)))
    assert gen.generate("spending by category", ALLOWED) == spec


def test_generate_strips_markdown_fences():
    spec = {"metric": "count", "groupBy": "vendor", "dateRange": "all", "chart": "bar"}
    fenced = "```json\n" + json.dumps(spec) + "\n```"
    gen = ChartSpecGenerator("http://ollama:11434", "m", client=make_client(fenced))
    assert gen.generate("count by vendor", ALLOWED) == spec


def test_generate_passes_unsupported_marker_through():
    gen = ChartSpecGenerator("http://ollama:11434", "m", client=make_client('{"unsupported": true}'))
    assert gen.generate("the weather", ALLOWED) == {"unsupported": True}


def test_generate_returns_unsupported_on_invalid_json():
    gen = ChartSpecGenerator("http://ollama:11434", "m", client=make_client("not json {{{"))
    assert gen.generate("x", ALLOWED) == {"unsupported": True}


def test_generate_returns_unsupported_on_non_object():
    gen = ChartSpecGenerator("http://ollama:11434", "m", client=make_client('[1, 2, 3]'))
    assert gen.generate("x", ALLOWED) == {"unsupported": True}


def test_prompt_lists_allowed_tokens():
    client = make_client('{"unsupported": true}')
    gen = ChartSpecGenerator("http://ollama:11434", "m", client=client)
    gen.generate("x", ALLOWED)

    system_prompt = client.post.call_args.kwargs["json"]["messages"][0]["content"]
    assert "sum_amount" in system_prompt
    assert "category" in system_prompt
    assert "last_3_months" in system_prompt
    assert "pie" in system_prompt
