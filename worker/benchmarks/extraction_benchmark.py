"""
Extraction-engine testbench.

Compares every extraction option (default / docling / pymupdf4llm, CPU & GPU)
on the boletos in ``assets/`` — each present as a text-native PDF and a scanned
image PDF — measuring time and accuracy two ways:

  * fidelity : do the known boleto values survive in the raw extracted text?
  * e2e      : run the real pipeline (minus persistence) through Ollama and
               set-match the resulting expenses against ground truth.

Run inside the worker container (PYTHONPATH=/app). See README.md for commands.
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import statistics
import time
import traceback
from dataclasses import dataclass
from datetime import date
from typing import Callable, Optional

from entities.document_context import DocumentContext
from extraction.extraction_strategy_factory import ExtractionStrategyFactory


# --------------------------------------------------------------------------- #
# Ground truth (confirmed with user)
# --------------------------------------------------------------------------- #

@dataclass(frozen=True)
class Expense:
    amount: float
    category: str


@dataclass(frozen=True)
class DocTruth:
    due_date: date
    due_date_str: str          # dd/mm/yyyy as printed
    payee: str                 # lowercase keyword expected in the text/vendor
    barcode_tail: str          # trailing digits of the linha digitável
    expenses: tuple[Expense, ...]


def load_ground_truth(assets_dir: str) -> tuple[dict[str, DocTruth], list[tuple[str, str, str]]]:
    """
    Load ground truth from ``<assets_dir>/ground_truth.json`` (written by
    generate_samples.py) and derive the file list (text-native + scanned twin).
    """
    with open(os.path.join(assets_dir, "ground_truth.json")) as fh:
        raw = json.load(fh)

    truths: dict[str, DocTruth] = {}
    files: list[tuple[str, str, str]] = []
    for base, d in raw.items():
        truths[base] = DocTruth(
            due_date=date.fromisoformat(d["due_date"]),
            due_date_str=d["due_date_str"],
            payee=d["payee"].casefold(),
            barcode_tail=d["barcode_tail"],
            expenses=tuple(Expense(e["amount"], e["category"]) for e in d["expenses"]),
        )
        files.append((base, f"{base}.pdf", "text"))
        files.append((base, f"{base}_image.pdf", "image"))
    return truths, files


# --------------------------------------------------------------------------- #
# Config matrix
# --------------------------------------------------------------------------- #

@dataclass(frozen=True)
class Config:
    name: str
    engine: str
    gpu: bool               # easyocr device (pymupdf4llm + fallback=easyocr)
    docling_device: str     # "cpu" | "cuda"
    fallback: str = "docling"


CONFIGS: list[Config] = [
    # New default: pdfplumber for text PDFs, Docling for scanned PDFs + images.
    Config("default-cpu", "default", False, "cpu", "docling"),
    Config("default-gpu", "default", True, "cuda", "docling"),
    # Fixed EasyOCR path (row reconstruction): pymupdf4llm text + easyocr OCR.
    Config("easyocr-cpu", "pymupdf4llm", False, "cpu", "easyocr"),
    Config("easyocr-gpu", "pymupdf4llm", True, "cpu", "easyocr"),
    # Docling everywhere.
    Config("docling-cpu", "docling", False, "cpu", "docling"),
    Config("docling-gpu", "docling", True, "cuda", "docling"),
]


def build_factory(cfg: Config) -> ExtractionStrategyFactory:
    return ExtractionStrategyFactory(
        gpu=cfg.gpu,
        engine=cfg.engine,
        fallback=cfg.fallback,
        docling_device=cfg.docling_device,
    )


def requires_gpu(cfg: Config) -> bool:
    """True when this config actually places a model on CUDA for some file."""
    if cfg.docling_device == "cuda":
        return True
    if cfg.gpu and cfg.fallback == "easyocr":  # easyocr OCR on GPU
        return True
    return False


# --------------------------------------------------------------------------- #
# Text normalization + scoring helpers
# --------------------------------------------------------------------------- #

def _digits(s: str) -> str:
    return re.sub(r"\D", "", s)


def amount_variants(amount: float) -> list[str]:
    """Digit form (no separators) and BR-formatted 'x.xxx,yy' digits."""
    cents = f"{amount:.2f}"                    # "2079.70"
    return [_digits(cents)]                    # "207970" (matches any separator style)


def fidelity_score(text: str, truth: DocTruth) -> tuple[float, dict[str, bool]]:
    lowered = text.casefold()
    digits = _digits(text)

    hits: dict[str, bool] = {}
    for exp in truth.expenses:
        key = f"amount_{exp.amount:.2f}"
        hits[key] = any(v in digits for v in amount_variants(exp.amount))
    hits["due_date"] = _digits(truth.due_date_str) in digits
    hits["payee"] = truth.payee in lowered
    hits["barcode"] = truth.barcode_tail in digits

    score = sum(hits.values()) / len(hits)
    return score, hits


@dataclass
class MatchStats:
    expected_n: int
    got_n: int
    amount_matched: int
    category_correct: int
    date_correct: int
    extra: int


def match_expenses(results: list, truth: DocTruth) -> MatchStats:
    """Greedily match results to expected expenses by amount (±0.01)."""
    remaining = list(results)
    amount_matched = category_correct = date_correct = 0
    for exp in truth.expenses:
        found = next(
            (r for r in remaining if abs(float(r.amount) - exp.amount) <= 0.01),
            None,
        )
        if found is None:
            continue
        remaining.remove(found)
        amount_matched += 1
        if found.category_slug == exp.category:
            category_correct += 1
        if found.expense_date == truth.due_date:
            date_correct += 1
    return MatchStats(
        expected_n=len(truth.expenses),
        got_n=len(results),
        amount_matched=amount_matched,
        category_correct=category_correct,
        date_correct=date_correct,
        extra=len(remaining),
    )


# --------------------------------------------------------------------------- #
# Timing
# --------------------------------------------------------------------------- #

def timed(fn: Callable[[], object], repeats: int) -> tuple[float, float, object]:
    """Return (cold_seconds, warm_median_seconds, last_result)."""
    t0 = time.perf_counter()
    result = fn()
    cold = time.perf_counter() - t0

    warm_times: list[float] = []
    for _ in range(max(0, repeats)):
        t0 = time.perf_counter()
        result = fn()
        warm_times.append(time.perf_counter() - t0)
    warm = statistics.median(warm_times) if warm_times else cold
    return cold, warm, result


def empty_cuda_cache() -> None:
    try:
        import torch

        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except Exception:
        pass


def cuda_available() -> bool:
    try:
        import torch

        return bool(torch.cuda.is_available())
    except Exception:
        return False


# --------------------------------------------------------------------------- #
# Benchmark rows
# --------------------------------------------------------------------------- #

@dataclass
class FidelityRow:
    config: str
    doc: str
    kind: str
    strategy: str
    cold_s: Optional[float]
    time_s: Optional[float]
    accuracy: Optional[float]
    detail: str
    error: str = ""


@dataclass
class E2ERow:
    config: str
    doc: str
    kind: str
    expected_n: int
    got_n: Optional[int]
    amount_matched: Optional[int]
    category_correct: Optional[int]
    date_correct: Optional[int]
    extra: Optional[int]
    time_s: Optional[float]
    error: str = ""


# --------------------------------------------------------------------------- #
# Fidelity mode
# --------------------------------------------------------------------------- #

def run_fidelity(assets_dir: str, repeats: int, truths: dict, files: list) -> list[FidelityRow]:
    rows: list[FidelityRow] = []
    have_cuda = cuda_available()

    for cfg in CONFIGS:
        if requires_gpu(cfg) and not have_cuda:
            for base, filename, kind in files:
                rows.append(FidelityRow(cfg.name, base, kind, "-", None, None,
                                        None, "", "CUDA unavailable — skipped"))
            print(f"[skip] {cfg.name}: CUDA unavailable")
            continue

        factory = build_factory(cfg)
        for base, filename, kind in files:
            path = os.path.join(assets_dir, filename)
            truth = truths[base]
            try:
                strategy = factory.get_strategy(path, "PDF")
                strategy_name = type(strategy).__name__

                cold, warm, pages = timed(lambda: strategy.extract(path), repeats)
                text = "\n\n".join(pages)  # type: ignore[arg-type]
                score, hits = fidelity_score(text, truth)
                detail = " ".join(k for k, v in hits.items() if v) or "—"
                rows.append(FidelityRow(cfg.name, base, kind, strategy_name,
                                        cold, warm, score, detail))
                print(f"[fidelity] {cfg.name:16} {filename:22} "
                      f"{strategy_name:20} {warm:7.2f}s acc={score:.2f}")
            except Exception as exc:  # noqa: BLE001 — record & continue
                empty_cuda_cache()
                rows.append(FidelityRow(cfg.name, base, kind, "-", None, None,
                                        None, "", repr(exc)))
                print(f"[fidelity] {cfg.name:16} {filename:22} ERROR {exc!r}")
                traceback.print_exc()
        empty_cuda_cache()
    return rows


# --------------------------------------------------------------------------- #
# End-to-end mode
# --------------------------------------------------------------------------- #

def build_pipeline_stages(factory: ExtractionStrategyFactory):
    from classification.llm_classifier import LlmClassifier
    from config import config
    from pipeline.classification_stage import ClassificationStage
    from pipeline.extraction_stage import ExtractionStage
    from pipeline.postprocessing_stage import PostprocessingStage
    from pipeline.preprocessing_stage import PreprocessingStage
    from pipeline.segmentation_stage import SegmentationStage
    from pipeline.validation_stage import ValidationStage

    classifier = LlmClassifier(base_url=config.ollama_url, model=config.ollama_model)
    return [
        ExtractionStage(factory),
        SegmentationStage(),
        ValidationStage(),
        PreprocessingStage(),
        ClassificationStage(classifier),
        PostprocessingStage(),
        # PersistenceStage intentionally omitted — we read ctx._classification_results.
    ]


def run_e2e(assets_dir: str, truths: dict, files: list) -> list[E2ERow]:
    rows: list[E2ERow] = []
    have_cuda = cuda_available()

    for cfg in CONFIGS:
        if requires_gpu(cfg) and not have_cuda:
            for base, filename, kind in files:
                t = truths[base]
                rows.append(E2ERow(cfg.name, base, kind, len(t.expenses), None,
                                   None, None, None, None, None,
                                   "CUDA unavailable — skipped"))
            print(f"[skip] {cfg.name}: CUDA unavailable")
            continue

        factory = build_factory(cfg)
        stages = build_pipeline_stages(factory)
        for base, filename, kind in files:
            path = os.path.join(assets_dir, filename)
            truth = truths[base]
            ctx = DocumentContext(
                document_id=f"bench-{cfg.name}-{base}",
                user_id="bench",
                file_path=path,
                file_type="PDF",
            )
            try:
                t0 = time.perf_counter()
                for stage in stages:
                    stage.process(ctx)
                elapsed = time.perf_counter() - t0

                results = getattr(ctx, "_classification_results", [])
                m = match_expenses(results, truth)
                rows.append(E2ERow(cfg.name, base, kind, m.expected_n, m.got_n,
                                   m.amount_matched, m.category_correct,
                                   m.date_correct, m.extra, elapsed))
                print(f"[e2e] {cfg.name:16} {filename:22} "
                      f"{elapsed:7.2f}s matched={m.amount_matched}/{m.expected_n} "
                      f"cat={m.category_correct} extra={m.extra}")
            except Exception as exc:  # noqa: BLE001 — record & continue
                empty_cuda_cache()
                rows.append(E2ERow(cfg.name, base, kind, len(truth.expenses),
                                   None, None, None, None, None, None, repr(exc)))
                print(f"[e2e] {cfg.name:16} {filename:22} ERROR {exc!r}")
        empty_cuda_cache()
    return rows


# --------------------------------------------------------------------------- #
# Output
# --------------------------------------------------------------------------- #

def _fmt(x: Optional[float]) -> str:
    return "" if x is None else (f"{x:.2f}" if isinstance(x, float) else str(x))


def write_table(path_base: str, headers: list[str], rows: list[list]) -> None:
    os.makedirs(os.path.dirname(path_base), exist_ok=True)
    with open(path_base + ".csv", "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(headers)
        w.writerows(rows)
    with open(path_base + ".md", "w") as fh:
        fh.write("| " + " | ".join(headers) + " |\n")
        fh.write("| " + " | ".join("---" for _ in headers) + " |\n")
        for r in rows:
            fh.write("| " + " | ".join(str(c) for c in r) + " |\n")


def emit_fidelity(rows: list[FidelityRow], out_dir: str) -> None:
    headers = ["config", "doc", "kind", "strategy", "cold_s", "time_s",
               "accuracy", "fields_hit", "error"]
    table = [[r.config, r.doc, r.kind, r.strategy, _fmt(r.cold_s), _fmt(r.time_s),
              _fmt(r.accuracy), r.detail, r.error] for r in rows]
    write_table(os.path.join(out_dir, "fidelity"), headers, table)
    print("\n=== FIDELITY ===")
    print("| " + " | ".join(headers) + " |")
    for r in table:
        print("| " + " | ".join(str(c) for c in r) + " |")


def emit_e2e(rows: list[E2ERow], out_dir: str) -> None:
    headers = ["config", "doc", "kind", "expected_n", "got_n", "amount_matched",
               "category_correct", "date_correct", "extra", "time_s", "error"]
    table = [[r.config, r.doc, r.kind, r.expected_n, _fmt(r.got_n),
              _fmt(r.amount_matched), _fmt(r.category_correct), _fmt(r.date_correct),
              _fmt(r.extra), _fmt(r.time_s), r.error] for r in rows]
    write_table(os.path.join(out_dir, "e2e"), headers, table)
    print("\n=== END-TO-END ===")
    print("| " + " | ".join(headers) + " |")
    for r in table:
        print("| " + " | ".join(str(c) for c in r) + " |")


# --------------------------------------------------------------------------- #
# Entry point
# --------------------------------------------------------------------------- #

def main() -> None:
    parser = argparse.ArgumentParser(description="Extraction-engine testbench")
    parser.add_argument("--mode", choices=["extraction", "e2e", "both"],
                        default="both")
    parser.add_argument("--assets-dir", default="/assets")
    parser.add_argument("--out-dir", default="benchmarks/results")
    parser.add_argument("--repeats", type=int, default=1,
                        help="warm timed runs per file (after the cold run)")
    args = parser.parse_args()

    print(f"CUDA available: {cuda_available()}")
    truths, files = load_ground_truth(args.assets_dir)
    print(f"Loaded {len(truths)} documents from ground_truth.json")

    if args.mode in ("extraction", "both"):
        emit_fidelity(run_fidelity(args.assets_dir, args.repeats, truths, files), args.out_dir)
    if args.mode in ("e2e", "both"):
        emit_e2e(run_e2e(args.assets_dir, truths, files), args.out_dir)


if __name__ == "__main__":
    main()
