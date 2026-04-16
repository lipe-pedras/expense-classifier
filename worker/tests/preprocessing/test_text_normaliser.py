import pytest
from preprocessing.text_normaliser import normalise


def test_strips_leading_trailing_whitespace():
    assert normalise("  hello  ") == "hello"


def test_collapses_multiple_spaces():
    assert normalise("hello   world") == "hello world"


def test_removes_control_characters():
    assert normalise("hello\x01world") == "helloworld"


def test_preserves_newlines():
    result = normalise("line1\nline2")
    assert "line1" in result
    assert "line2" in result


def test_nfc_normalisation():
    # e + combining acute = é (NFC)
    composed = "\u00e9"
    decomposed = "e\u0301"
    assert normalise(decomposed) == composed


def test_replaces_nbsp_with_space():
    result = normalise("hello\u00a0world")
    assert result == "hello world"


def test_empty_string():
    assert normalise("") == ""


def test_only_whitespace():
    assert normalise("   \t  ") == ""
