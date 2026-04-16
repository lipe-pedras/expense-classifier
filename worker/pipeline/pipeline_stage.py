from abc import ABC, abstractmethod

from entities.document_context import DocumentContext


class PipelineStage(ABC):
    """Base class for all chain-of-responsibility pipeline stages."""

    @abstractmethod
    def process(self, ctx: DocumentContext) -> None:
        """Mutate *ctx* in-place.  Raise to abort the job."""
        ...
