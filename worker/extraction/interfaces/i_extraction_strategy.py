from abc import ABC, abstractmethod


class IExtractionStrategy(ABC):
    """Extracts raw text from a document file."""

    @abstractmethod
    def extract(self, file_path: str) -> list[str]:
        """Return one string per page/image found in the file."""
        ...
