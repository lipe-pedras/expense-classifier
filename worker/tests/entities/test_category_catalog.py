from entities.category_catalog import (
    DEFAULT_CATEGORIES,
    resolve_categories,
    valid_slugs,
)


def test_resolve_falls_back_to_defaults_when_empty():
    assert resolve_categories([]) == DEFAULT_CATEGORIES
    assert resolve_categories(None) == DEFAULT_CATEGORIES


def test_resolve_drops_entries_without_slug():
    resolved = resolve_categories([{"name": "No Slug"}, {"slug": "gym", "name": "Gym"}])
    slugs = [c["slug"] for c in resolved]
    assert "gym" in slugs
    assert all(c.get("slug") for c in resolved)


def test_resolve_appends_other_when_missing():
    resolved = resolve_categories([{"slug": "gym", "name": "Gym"}])
    slugs = [c["slug"] for c in resolved]
    assert "gym" in slugs
    assert "other" in slugs


def test_resolve_keeps_other_when_present():
    resolved = resolve_categories([
        {"slug": "gym", "name": "Gym"},
        {"slug": "other", "name": "Other"},
    ])
    assert [c["slug"] for c in resolved].count("other") == 1


def test_valid_slugs_returns_set():
    assert valid_slugs([{"slug": "gym", "name": "Gym"}]) == {"gym", "other"}


def test_valid_slugs_defaults():
    assert valid_slugs(None) == {c["slug"] for c in DEFAULT_CATEGORIES}
