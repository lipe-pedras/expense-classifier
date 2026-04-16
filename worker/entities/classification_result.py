from dataclasses import dataclass
from datetime import date
from typing import Optional


@dataclass
class ClassificationResult:
    """Structured output from the LLM classification step for one segment."""
    segment_index: int
    category_slug: str
    vendor: Optional[str]
    amount: float
    currency: str
    expense_date: date
    confidence: float
    raw_text: str
