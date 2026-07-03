from entities.document_context import DocumentContext, DocumentSegment
from jobs import build_classification_job, context_from_classification_job


def test_build_classification_job_serialises_segments_and_categories():
    ctx = DocumentContext("doc-1", "user-1", "/f", "PDF")
    ctx.categories = [{"slug": "gym", "name": "Gym"}]
    ctx.segments = [
        DocumentSegment(index=0, raw_text="raw0", normalised_text="norm0"),
        DocumentSegment(index=1, raw_text="raw1", normalised_text=""),
    ]

    job = build_classification_job(ctx)

    assert job["documentId"] == "doc-1"
    assert job["userId"] == "user-1"
    assert job["categories"] == [{"slug": "gym", "name": "Gym"}]
    # normalised text is preferred; falls back to raw when normalisation is empty
    assert job["segments"] == [
        {"index": 0, "text": "norm0"},
        {"index": 1, "text": "raw1"},
    ]


def test_context_from_classification_job_round_trips():
    ctx = DocumentContext("doc-1", "user-1", "/f", "PDF")
    ctx.categories = [{"slug": "gym", "name": "Gym"}]
    ctx.segments = [DocumentSegment(index=0, raw_text="raw", normalised_text="norm")]

    rebuilt = context_from_classification_job(build_classification_job(ctx))

    assert rebuilt.document_id == "doc-1"
    assert rebuilt.user_id == "user-1"
    assert rebuilt.categories == [{"slug": "gym", "name": "Gym"}]
    assert len(rebuilt.segments) == 1
    assert rebuilt.segments[0].index == 0
    assert rebuilt.segments[0].normalised_text == "norm"


def test_context_from_classification_job_tolerates_missing_optional_fields():
    ctx = context_from_classification_job({"documentId": "d", "userId": "u"})
    assert ctx.categories == []
    assert ctx.segments == []
    # file_path/file_type are unused by the llm-worker's stages
    assert ctx.file_path == ""
    assert ctx.file_type == ""
