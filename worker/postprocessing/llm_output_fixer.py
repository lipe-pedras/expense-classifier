import re
from datetime import date, datetime

from entities.classification_result import ClassificationResult

_VALID_SLUGS = {"rent", "water", "electricity", "internet", "insurance", "other"}

# Patterns to strip currency symbols before parsing amount
_CURRENCY_SYMBOLS = re.compile(r"[R$€£¥\s,]")
_AMOUNT_PATTERN = re.compile(r"[\d]+(?:[.,]\d+)*")


def fix(result: ClassificationResult) -> ClassificationResult:
    """
    Apply heuristic corrections to a ClassificationResult produced by the LLM:

    - Normalise category_slug to a valid value (fallback "other")
    - Clamp confidence to [0, 1]
    - Ensure amount >= 0
    - Ensure expense_date is not in the future
    - Strip None/empty vendor
    """
    slug = result.category_slug.lower().strip() if result.category_slug else "other"
    if slug not in _VALID_SLUGS:
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
