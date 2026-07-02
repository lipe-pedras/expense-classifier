import os


class Config:
    redis_url: str = os.environ.get("REDIS_URL", "redis://localhost:6379")
    api_base_url: str = os.environ.get("API_BASE_URL", "http://api:3000")
    internal_service_token: str = os.environ.get("INTERNAL_SERVICE_TOKEN", "dev_internal_token")
    ollama_url: str = os.environ.get("OLLAMA_URL", "http://ollama:11434")
    ollama_model: str = os.environ.get("OLLAMA_MODEL", "qwen2.5:7b-instruct-q3_K_M")
    file_upload_path: str = os.environ.get("FILE_UPLOAD_PATH", "/app/uploads")
    # EasyOCR GPU flag — disable in test environments
    easyocr_gpu: bool = os.environ.get("EASYOCR_GPU", "true").lower() == "true"
    # Extraction engine: "default" (pdfplumber/EasyOCR), "docling", or "pymupdf4llm".
    extraction_engine: str = os.environ.get("EXTRACTION_ENGINE", "default").lower()
    # Fallback engine for the pymupdf4llm engine on images / scanned PDFs
    # (pymupdf4llm cannot OCR): "docling" (default) or "easyocr".
    extraction_fallback: str = os.environ.get("EXTRACTION_FALLBACK", "docling").lower()
    # Device Docling runs on: "cpu" (default, safe) or "cuda" (needs GPU + free VRAM).
    docling_device: str = os.environ.get("DOCLING_DEVICE", "cpu").lower()


config = Config()
