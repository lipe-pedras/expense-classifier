import pdfplumber


# Minimum average character count per page to consider a PDF text-native
_MIN_CHARS_PER_PAGE = 20


def is_text_pdf(file_path: str) -> bool:
    """
    Return True if the PDF has a meaningful text layer (text-native PDF),
    False if it is a scanned/image-only PDF.
    """
    with pdfplumber.open(file_path) as pdf:
        if not pdf.pages:
            return False
        total_chars = sum(
            len(page.extract_text() or "") for page in pdf.pages
        )
        avg = total_chars / len(pdf.pages)
    return avg >= _MIN_CHARS_PER_PAGE
