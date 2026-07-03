"""Job contracts shared by the extractor and the llm-worker.

The pipeline is split across two services connected by a Redis queue:

* the **extractor** consumes ``document-processing`` (extract → segment →
  validate → preprocess) and enqueues a ``classification`` job, and
* the **llm-worker** consumes ``classification`` (classify → postprocess →
  persist).

These helpers build and parse the classification job payload so both sides
agree on its shape (camelCase to match the API-produced payloads).
"""
from entities.document_context import DocumentContext, DocumentSegment

CLASSIFICATION_QUEUE_NAME = "classification"
CLASSIFICATION_JOB_NAME = "classify-document"

# Natural-language → chart-spec requests. The llm-worker produces only a JSON
# query spec here; the API compiles and runs the SQL.
CHART_QUEUE_NAME = "chart-generation"


def build_classification_job(ctx: DocumentContext) -> dict:
    """Serialise the extractor's context into a classification job payload.

    Only the preprocessed segment text and the user's categories are carried
    over — the llm-worker never needs the original file.
    """
    return {
        "documentId": ctx.document_id,
        "userId": ctx.user_id,
        "categories": ctx.categories,
        "segments": [
            {"index": seg.index, "text": seg.normalised_text or seg.raw_text}
            for seg in ctx.segments
        ],
    }


def context_from_classification_job(data: dict) -> DocumentContext:
    """Rebuild a DocumentContext from a classification job payload.

    ``file_path``/``file_type`` are left empty because the llm-worker's stages
    (classify → postprocess → persist) never touch the source file.
    """
    ctx = DocumentContext(
        document_id=data["documentId"],
        user_id=data["userId"],
        file_path="",
        file_type="",
        categories=data.get("categories", []),
    )
    ctx.segments = [
        DocumentSegment(
            index=seg["index"],
            raw_text="",
            normalised_text=seg.get("text", ""),
        )
        for seg in data.get("segments", [])
    ]
    return ctx
