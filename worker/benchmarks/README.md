# Extraction-engine testbench

Compares the extraction options (`default`, `docling`, `pymupdf4llm`, each CPU &
GPU) on the boletos in `assets/` — every boleto as a text-native PDF and a
scanned image PDF — measuring **time** and **accuracy**.

Accuracy is measured two ways:

- **fidelity** — do the known boleto values (per-line-item amounts, due date,
  payee, barcode digits) survive in the raw extracted text? Deterministic, no LLM.
- **e2e** — run the real pipeline minus persistence (extraction → normalization →
  segmentation → Ollama classification → post-processing) and set-match the
  resulting expenses against ground truth.

Ground truth lives in `extraction_benchmark.py` (`GROUND_TRUTH`). A document can
hold multiple expenses; results are matched by amount (±0.01).

## Run (docker compose only — the host has no Python deps)

`assets/` is not in the worker volume, so mount it at `/assets`.

### Fidelity (no Ollama; free the GPU so docling-gpu has VRAM)

```bash
docker compose -f docker-compose.dev.yml stop ollama
docker compose -f docker-compose.dev.yml run --rm \
  -v "$PWD/assets:/assets" worker \
  python benchmarks/extraction_benchmark.py --mode extraction
```

### End-to-end (needs Ollama up with the model pulled)

```bash
docker compose -f docker-compose.dev.yml up -d ollama redis api postgres
docker compose -f docker-compose.dev.yml run --rm \
  -v "$PWD/assets:/assets" worker \
  python benchmarks/extraction_benchmark.py --mode e2e
```

With Ollama holding VRAM (~1 GB free), GPU extraction configs may CUDA-OOM; the
script records that per run instead of crashing. GPU configs are skipped
automatically when CUDA is unavailable.

If your Docker/Compose ignores the worker service's `deploy.resources` GPU
reservation under `run`, use the built image directly:

```bash
docker run --rm --gpus all -v "$PWD/assets:/assets" \
  -v "$PWD/worker:/app" -w /app new_ai_expense-worker \
  python benchmarks/extraction_benchmark.py --mode extraction
```

## Output

Tables are printed to stdout and written to `benchmarks/results/`:
`fidelity.{csv,md}` and `e2e.{csv,md}`.
