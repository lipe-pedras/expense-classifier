from abc import ABC, abstractmethod


class IExtractionStrategy(ABC):
    """Extracts raw text from a document file."""

    @abstractmethod
    def extract(self, file_path: str) -> str:
        """Return all text found in the file as a single string."""
        ...
