import re
from datetime import date, datetime

from entities.classification_result import ClassificationResult
from entities.category_catalog import valid_slugs as _default_valid_slugs

_VALID_SLUGS = _default_valid_slugs(None)

# Patterns to strip currency symbols before parsing amount
_CURRENCY_SYMBOLS = re.compile(r"[R$€£¥\s,]")
_AMOUNT_PATTERN = re.compile(r"[\d]+(?:[.,]\d+)*")


def fix(result: ClassificationResult, valid: set[str] | None = None) -> ClassificationResult:
    """
    Apply heuristic corrections to a ClassificationResult produced by the LLM:

    - Normalise category_slug to a valid value (fallback "other"). When ``valid``
      is given it is used as the acceptable slug set (the user's categories);
      otherwise the built-in defaults apply.
    - Clamp confidence to [0, 1]
    - Ensure amount >= 0
    - Ensure expense_date is not in the future
    - Strip None/empty vendor
    """
    allowed = valid if valid else _VALID_SLUGS
    slug = result.category_slug.lower().strip() if result.category_slug else "other"
    if slug not in allowed:
        slug = "other"

    amount = max(0.0, result.amount)
    confidence = min(1.0, max(0.0, result.confidence))

    today = date.today()
    expense_date = result.expense_date if result.expense_date <= today else today

    vendor = result.vendor.strip() if result.vendor and result.vendor.strip() else None

    return ClassificationResult(
        segment_index=result.segment_index,
        category_slug=slug,
        vendor=vendor,
        amount=amount,
        currency=result.currency or "BRL",
        expense_date=expense_date,
        confidence=confidence,
        raw_text=result.raw_text,
    )


def deduplicate(results: list[ClassificationResult]) -> list[ClassificationResult]:
    """
    Remove duplicate expenses from the list, keeping the first occurrence.

    Two expenses are considered duplicates if they share the same
    (category_slug, vendor, amount, currency, expense_date).
    """
    seen: set[tuple] = set()
    unique: list[ClassificationResult] = []
    for r in results:
        key = (r.category_slug, r.vendor, r.amount, r.currency, r.expense_date)
        if key not in seen:
            seen.add(key)
            unique.append(r)
    return unique
