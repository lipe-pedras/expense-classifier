"""Category catalog helpers shared by the classifier and the output fixer.

A job now carries the user's own categories (``[{"slug", "name"}, ...]``) in its
payload. These helpers resolve that list — falling back to the built-in defaults
for the pre-warm call and for any legacy job enqueued before the API started
attaching categories — and always guarantee an ``other`` bucket exists.
"""

DEFAULT_CATEGORIES: list[dict] = [
    {"slug": "rent", "name": "Rent"},
    {"slug": "water", "name": "Water"},
    {"slug": "electricity", "name": "Electricity"},
    {"slug": "internet", "name": "Internet"},
    {"slug": "insurance", "name": "Insurance"},
    {"slug": "other", "name": "Other"},
]


def resolve_categories(categories: list[dict] | None) -> list[dict]:
    """Return the given categories, or the defaults when none were provided.

    Entries without a ``slug`` are dropped, and an ``other`` fallback is appended
    when absent so the classifier and fixer always have a safe bucket.
    """
    cats = [c for c in (categories or []) if c.get("slug")]
    if not cats:
        return list(DEFAULT_CATEGORIES)
    if not any(c["slug"] == "other" for c in cats):
        cats = cats + [{"slug": "other", "name": "Other"}]
    return cats


def valid_slugs(categories: list[dict] | None) -> set[str]:
    """The set of acceptable category slugs for the given (resolved) categories."""
    return {c["slug"] for c in resolve_categories(categories)}
