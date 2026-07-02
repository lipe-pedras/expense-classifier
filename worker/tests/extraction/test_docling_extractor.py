from types import SimpleNamespace

from extraction.docling_extractor import DoclingExtractor
from extraction.interfaces.i_extraction_strategy import IExtractionStrategy


def _item(text: str, page_no: int):
    return SimpleNamespace(text=text, prov=[SimpleNamespace(page_no=page_no)])


class _FakeDocument:
    def __init__(self, pages, items, markdown="MARKDOWN"):
        self.pages = pages
        self._items = items
        self._markdown = markdown

    def iterate_items(self):
        for item in self._items:
            yield item, 0

    def export_to_markdown(self):
        return self._markdown


class _FakeConverter:
    def __init__(self, document):
        self._document = document

    def convert(self, file_path):
        return SimpleNamespace(document=self._document)


def test_is_extraction_strategy():
    extractor = DoclingExtractor(converter=_FakeConverter(_FakeDocument({}, [])))
    assert isinstance(extractor, IExtractionStrategy)


def test_extract_groups_text_by_page():
    document = _FakeDocument(
        pages={1: object(), 2: object()},
        items=[
            _item("hello", 1),
            _item("world", 1),
            _item("second page", 2),
        ],
    )
    extractor = DoclingExtractor(converter=_FakeConverter(document))

    assert extractor.extract("/a/b.pdf") == ["hello\nworld", "second page"]


def test_extract_preserves_page_order_and_empty_pages():
    document = _FakeDocument(
        pages={2: object(), 1: object()},
        items=[_item("only on two", 2)],
    )
    extractor = DoclingExtractor(converter=_FakeConverter(document))

    # Page 1 has no items → empty string; pages returned in ascending order.
    assert extractor.extract("/a/b.pdf") == ["", "only on two"]


def test_extract_falls_back_to_markdown_without_pages():
    document = _FakeDocument(pages={}, items=[], markdown="# Receipt\nTotal 10")
    extractor = DoclingExtractor(converter=_FakeConverter(document))

    assert extractor.extract("/a/b.pdf") == ["# Receipt\nTotal 10"]
