"""
Generate synthetic boleto-style sample documents for the extraction testbench.

For each spec we render a text-native PDF (`<base>.pdf`) and a scanned image PDF
(`<base>_image.pdf`), plus a `ground_truth.json` manifest the benchmark reads.

The set deliberately spans easy → hard: large vs tiny fonts, inline vs table
layout, single vs many expenses, and single vs multi-page documents. The scanned
twins degrade with difficulty (lower DPI, noise, slight rotation).

Run in the worker container (fitz + PIL + numpy are already installed):

    docker compose -f docker-compose.dev.yml run --rm --no-deps \
      --user "$(id -u):$(id -g)" -v "$PWD/assets:/assets" worker \
      python benchmarks/generate_samples.py --out-dir /assets
"""
from __future__ import annotations

import argparse
import json
import os
import random
from dataclasses import dataclass, field
from datetime import date

import fitz  # PyMuPDF
import numpy as np
from PIL import Image

PAGE_W, PAGE_H = 595.0, 842.0  # A4 in points
LEFT, RIGHT = 50.0, 545.0


@dataclass
class Spec:
    base: str
    payee: str
    keyword: str          # lowercase substring of payee, used as ground-truth token
    due: date
    font: float
    pages: int
    expenses: list[tuple[str, float, str]]  # (description, amount, category_slug)
    dpi: int
    noise_sigma: float = 0.0
    rotate_deg: float = 0.0
    marketing: bool = False


def br(amount: float) -> str:
    """Brazilian currency formatting: 1234.5 -> '1.234,50'."""
    s = f"{amount:,.2f}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


def _chunk(items: list, n: int) -> list[list]:
    """Split items into n roughly equal contiguous chunks."""
    if n <= 1:
        return [items]
    size = (len(items) + n - 1) // n
    return [items[i : i + size] for i in range(0, len(items), size)] or [[]]


MARKETING = [
    "Pague suas faturas via PIX e ganhe pontos no nosso programa de vantagens!",
    "Baixe o aplicativo e acompanhe seu consumo em tempo real.",
    "Evite juros e multa: cadastre o débito automático hoje mesmo.",
    "Central de atendimento 24h. Fale conosco pelo WhatsApp.",
    "Este documento não é válido como nota fiscal de serviço.",
]


def _draw_barcode(page: fitz.Page, x: float, y: float, width: float, height: float, rng: random.Random) -> None:
    cx = x
    while cx < x + width:
        w = rng.choice([0.6, 1.2, 1.8, 2.4])
        if rng.random() < 0.6:
            page.draw_rect(fitz.Rect(cx, y, cx + w, y + height), fill=(0, 0, 0), color=(0, 0, 0))
        cx += w + rng.choice([0.6, 1.0, 1.5])


def render_text_pdf(spec: Spec, cnpj: str, barcode_line: str, path: str, rng: random.Random) -> None:
    doc = fitz.open()
    chunks = _chunk(spec.expenses, spec.pages)
    fs = spec.font
    due_str = spec.due.strftime("%d/%m/%Y")
    total = sum(a for _, a, _ in spec.expenses)

    for pi in range(spec.pages):
        page = doc.new_page(width=PAGE_W, height=PAGE_H)
        y = 60.0
        page.insert_text((LEFT, y), spec.payee, fontsize=fs + 6, fontname="hebo")
        y += fs + 16
        page.insert_text((LEFT, y), f"CNPJ {cnpj}   Fatura Ref. {spec.due.strftime('%m/%Y')}", fontsize=fs - 2)
        y += fs + 8
        page.insert_text((LEFT, y), f"Pagador: Cliente Exemplo   Vencimento: {due_str}", fontsize=fs - 2)
        y += fs + 18
        page.insert_text((LEFT, y), f"Composicao da cobranca (pagina {pi + 1}/{spec.pages})",
                         fontsize=fs, fontname="hebo")
        y += fs + 8

        page.draw_line((LEFT, y), (RIGHT, y)); y += fs + 4
        page.insert_text((LEFT + 5, y), "Descricao", fontsize=fs, fontname="hebo")
        page.insert_text((440, y), "Valor", fontsize=fs, fontname="hebo")
        y += 6
        page.draw_line((LEFT, y), (RIGHT, y)); y += fs + 6

        for desc, amt, _cat in chunks[pi]:
            page.insert_text((LEFT + 5, y), desc, fontsize=fs)
            amt_s = "R$ " + br(amt)
            w = fitz.get_text_length(amt_s, fontsize=fs)
            page.insert_text((RIGHT - 5 - w, y), amt_s, fontsize=fs)
            y += fs + 6
        page.draw_line((LEFT, y), (RIGHT, y)); y += fs + 10

        if pi == spec.pages - 1:
            page.insert_text((LEFT + 5, y), f"Valor do documento: R$ {br(total)}",
                             fontsize=fs, fontname="hebo")
            y += fs + 8
            page.insert_text((LEFT + 5, y), f"Vencimento: {due_str}", fontsize=fs)
            y += fs + 16
            page.insert_text((LEFT, y), barcode_line, fontsize=fs - 1, fontname="cour")
            y += fs + 6
            _draw_barcode(page, LEFT, y, RIGHT - LEFT, 38, rng)
            y += 60
            if spec.marketing:
                for line in MARKETING:
                    page.insert_text((LEFT, y), line, fontsize=fs - 2)
                    y += fs + 2

    doc.save(path)
    doc.close()


def render_scanned_pdf(text_pdf_path: str, out_path: str, spec: Spec, rng: random.Random) -> None:
    src = fitz.open(text_pdf_path)
    images: list[Image.Image] = []
    for page in src:
        pix = page.get_pixmap(dpi=spec.dpi)
        img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        if spec.rotate_deg:
            img = img.rotate(rng.uniform(-spec.rotate_deg, spec.rotate_deg),
                             expand=False, fillcolor=(255, 255, 255))
        if spec.noise_sigma > 0:
            arr = np.array(img).astype(np.float32)
            arr += np.random.normal(0, spec.noise_sigma, arr.shape)
            img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
        images.append(img.convert("RGB"))
    src.close()
    images[0].save(out_path, "PDF", save_all=True, append_images=images[1:],
                   resolution=float(spec.dpi))


def build_specs() -> list[Spec]:
    return [
        Spec("doc01_rent_easy", "Imobiliaria Solar", "solar", date(2026, 1, 10), 16, 1,
             [("Aluguel Janeiro/2026", 1500.00, "rent")], dpi=220),
        Spec("doc02_water_easy", "Saneamento Aguas Claras", "claras", date(2026, 2, 5), 15, 1,
             [("Consumo de Agua", 87.40, "water"), ("Taxa de Esgoto", 42.10, "other")], dpi=200),
        Spec("doc03_rent_table", "Mohallem Gestao", "mohallem", date(2026, 4, 18), 12, 1,
             [("Aluguel", 2079.70, "rent"), ("IPTU Parcela 2/10", 69.55, "other"),
              ("Seguro Incendio", 13.99, "insurance")], dpi=180),
        Spec("doc04_energy", "CPFL Energia", "cpfl", date(2026, 3, 20), 12, 1,
             [("Energia Eletrica", 231.88, "electricity"),
              ("Contrib Iluminacao Publica", 18.42, "other")], dpi=170),
        Spec("doc05_condo_small", "Condominio Ilha Bela", "bela", date(2026, 4, 10), 9, 1,
             [("Taxa de Condominio", 265.00, "other"), ("Agua", 107.08, "water"),
              ("Fundo de Reserva", 53.00, "other"), ("Consumo de Gas", 44.90, "other"),
              ("Multa de Atraso", 12.30, "other")], dpi=150, noise_sigma=4.0),
        Spec("doc06_school_2p", "Universidade Federal", "federal", date(2026, 5, 15), 12, 2,
             [("Mensalidade", 890.00, "other"), ("Material Didatico", 120.00, "other"),
              ("Seguro Estudantil", 35.00, "insurance"), ("Internet Laboratorio", 60.00, "internet")],
             dpi=160),
        Spec("doc07_market_many", "SuperMercado Central", "central", date(2026, 6, 1), 8, 1,
             [("Hortifruti", 74.35, "other"), ("Acougue", 132.90, "other"),
              ("Padaria", 28.50, "other"), ("Limpeza", 45.10, "other"),
              ("Bebidas", 89.99, "other"), ("Laticinios", 37.80, "other"),
              ("Higiene", 52.40, "other"), ("Congelados", 61.25, "other")], dpi=150, noise_sigma=3.0),
        Spec("doc08_holding_3p", "Holding Predial", "predial", date(2026, 5, 28), 10, 3,
             [("Aluguel Sala 101", 1200.00, "rent"), ("Condominio", 340.00, "other"),
              ("Agua", 95.60, "water"), ("Energia Eletrica", 210.15, "electricity"),
              ("Internet Dedicada", 180.00, "internet"), ("Seguro Predial", 75.00, "insurance")],
             dpi=150),
        Spec("doc09_coop_tiny", "Cooperativa Agro", "agro", date(2026, 7, 3), 7, 1,
             [("Semente Milho", 320.00, "other"), ("Fertilizante", 540.50, "other"),
              ("Defensivo Agricola", 210.75, "other"), ("Racao Bovina", 430.00, "other"),
              ("Combustivel Diesel", 610.20, "other"), ("Energia Rural", 88.40, "electricity"),
              ("Agua Irrigacao", 66.90, "water"), ("Seguro Safra", 150.00, "insurance"),
              ("Internet Campo", 70.00, "internet"), ("Arrendamento", 900.00, "rent")],
             dpi=120, noise_sigma=6.0, rotate_deg=1.0),
        Spec("doc10_telecom_noise", "TelecomX Fibra", "telecomx", date(2026, 6, 22), 11, 1,
             [("Plano Internet 500MB", 119.90, "internet")], dpi=140, marketing=True),
    ]


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate synthetic testbench samples")
    parser.add_argument("--out-dir", default="/assets")
    parser.add_argument("--seed", type=int, default=1234)
    args = parser.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)
    rng = random.Random(args.seed)
    np.random.seed(args.seed)

    manifest: dict[str, dict] = {}
    for spec in build_specs():
        cnpj = f"{rng.randint(10, 99)}.{rng.randint(100, 999)}.{rng.randint(100, 999)}/0001-{rng.randint(10, 99)}"
        tail = "".join(str(rng.randint(0, 9)) for _ in range(14))
        groups = [f"{rng.randint(10000, 99999)}.{rng.randint(10000, 99999)}" for _ in range(3)]
        barcode_line = f"{groups[0]} {groups[1]} {groups[2]} {rng.randint(1, 9)} {tail}"

        text_path = os.path.join(args.out_dir, f"{spec.base}.pdf")
        image_path = os.path.join(args.out_dir, f"{spec.base}_image.pdf")
        render_text_pdf(spec, cnpj, barcode_line, text_path, rng)
        render_scanned_pdf(text_path, image_path, spec, rng)

        manifest[spec.base] = {
            "due_date": spec.due.isoformat(),
            "due_date_str": spec.due.strftime("%d/%m/%Y"),
            "payee": spec.keyword,
            "barcode_tail": tail,
            "expenses": [{"amount": a, "category": c} for _, a, c in spec.expenses],
        }
        print(f"[generate] {spec.base}: {spec.pages}p font{spec.font} "
              f"{len(spec.expenses)} expense(s) dpi{spec.dpi}")

    with open(os.path.join(args.out_dir, "ground_truth.json"), "w") as fh:
        json.dump(manifest, fh, indent=2, ensure_ascii=False)
    print(f"[generate] wrote {len(manifest)} docs + ground_truth.json to {args.out_dir}")


if __name__ == "__main__":
    main()
