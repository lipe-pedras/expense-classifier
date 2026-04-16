from dataclasses import dataclass, field
from typing import Optional


@dataclass
class DocumentSegment:
    """A single logical expense segment extracted from a document."""
    index: int
    raw_text: str
    # Normalised text produced by the preprocessing stage
    normalised_text: str = ""


@dataclass
class DocumentContext:
    """Shared state object threaded through every pipeline stage."""
    document_id: str
    user_id: str
    file_path: str
    file_type: str  # "PDF" | "IMAGE"

    # Set by the extraction stage
    raw_text: str = ""

    # Set by the segmentation stage
    segments: list[DocumentSegment] = field(default_factory=list)

    # Accumulated errors — a non-empty list causes ValidationStage to abort
    errors: list[str] = field(default_factory=list)
