from datetime import date, timedelta

import pytest

from entities.classification_result import ClassificationResult
from postprocessing.llm_output_fixer import fix


def make_result(**kwargs) -> ClassificationResult:
    defaults = dict(
        segment_index=0,
        category_slug="rent",
        vendor="Acme",
        amount=100.0,
        currency="BRL",
        expense_date=date(2026, 1, 15),
        confidence=0.9,
        raw_text="raw",
    )
    defaults.update(kwargs)
    return ClassificationResult(**defaults)


def test_valid_result_passes_through_unchanged():
    result = make_result()
    fixed = fix(result)
    assert fixed.category_slug == "rent"
    assert fixed.amount == 100.0
    assert fixed.confidence == 0.9


def test_invalid_slug_becomes_other():
    result = make_result(category_slug="groceries")
    fixed = fix(result)
    assert fixed.category_slug == "other"


def test_empty_slug_becomes_other():
    result = make_result(category_slug="")
    fixed = fix(result)
    assert fixed.category_slug == "other"


def test_confidence_clamped_above_one():
    result = make_result(confidence=1.5)
    fixed = fix(result)
    assert fixed.confidence == 1.0


def test_confidence_clamped_below_zero():
    result = make_result(confidence=-0.1)
    fixed = fix(result)
    assert fixed.confidence == 0.0


def test_negative_amount_becomes_zero():
    result = make_result(amount=-50.0)
    fixed = fix(result)
    assert fixed.amount == 0.0


def test_future_date_becomes_today():
    future = date.today() + timedelta(days=10)
    result = make_result(expense_date=future)
    fixed = fix(result)
    assert fixed.expense_date == date.today()


def test_past_date_preserved():
    past = date(2025, 6, 1)
    result = make_result(expense_date=past)
    fixed = fix(result)
    assert fixed.expense_date == past


def test_whitespace_only_vendor_becomes_none():
    result = make_result(vendor="   ")
    fixed = fix(result)
    assert fixed.vendor is None


def test_none_vendor_stays_none():
    result = make_result(vendor=None)
    fixed = fix(result)
    assert fixed.vendor is None
