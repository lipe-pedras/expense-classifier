import re
import unicodedata


def normalise(text: str) -> str:
    """
    Light normalisation applied to each segment's raw text before the LLM
    classification step:

    1. Unicode NFC normalisation (handles ligatures, combining characters)
    2. Replace non-breaking and other unusual whitespace with plain space
    3. Collapse runs of whitespace to a single space
    4. Strip leading/trailing whitespace
    5. Remove control characters (keep newlines for readability)
    """
    # NFC normalisation
    text = unicodedata.normalize("NFC", text)

    # Replace unusual whitespace (NBSP, thin space, etc.) with regular space
    text = re.sub(r"[^\S\n]", " ", text)

    # Collapse consecutive spaces on the same line
    text = re.sub(r" {2,}", " ", text)

    # Remove control characters except newline (\n = \x0a) and tab
    text = re.sub(r"[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]", "", text)

    return text.strip()
