#!/usr/bin/env python3
"""Build the living evidence record and Scale Signal pages from canonical YAML."""
from __future__ import annotations

import html
import re
import shutil
from datetime import date
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE_DIR = ROOT / "evidence"
SIGNALS_DIR = ROOT / "signals"
OUTPUT = ROOT / "evidence.html"
TEMPLATE = ROOT / "templates" / "evidence.html"
SIGNAL_TEMPLATE = ROOT / "templates" / "scale-signal.html"
SITEMAP = ROOT / "sitemap.xml"
SITE_ORIGIN = "https://agenticengineering.science"
GENERATED_MARKER = "<!-- GENERATED SCALE SIGNAL PAGE -->"
SITEMAP_START = "<!-- SCALE_SIGNAL_URLS_START -->"
SITEMAP_END = "<!-- SCALE_SIGNAL_URLS_END -->"
SIGNAL_ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def load_records() -> list[dict]:
    records = []
    for path in EVIDENCE_DIR.glob("*.yaml"):
        if not SIGNAL_ID_PATTERN.fullmatch(path.stem):
            raise SystemExit(f"Evidence filename is not a URL-safe stable ID: {path.name}")
        with path.open(encoding="utf-8") as handle:
            record = yaml.safe_load(handle)
        record["_path"] = path.name
        records.append(record)
    return sorted(records, key=lambda r: r["source"]["date"], reverse=True)


def transition_label(mapping: dict) -> str | None:
    transition = mapping.get("transition")
    if not transition:
        return None
    label = f'{transition["from"]} → {transition["to"]}'
    adjacent = transition.get("adjacent_stage")
    if adjacent:
        label += f" / {adjacent}"
    return label


def evidence_id(record: dict) -> str:
    return Path(record["_path"]).stem


def rendered_chips(record: dict) -> str:
    mapping = record["mapping"]
    chips = []
    transition = transition_label(mapping)
    if transition:
        chips.append(f'<span class="chip transition">{esc(transition)}</span>')
    else:
        chips.extend(f'<span class="chip transition">{esc(stage)}</span>' for stage in mapping["stages"])
    chips.extend(f'<span class="chip">{esc(condition)}</span>' for condition in mapping["conditions"])
    return "".join(chips)


def rendered_observed(record: dict) -> str:
    return "".join(f'<p>{esc(str(item).strip())}</p>' for item in record["observed"])


def render_entry(record: dict) -> str:
    source = record["source"]
    implication = record["model_implication"]
    published = date.fromisoformat(str(source["date"])).strftime("%B %-d, %Y")
    signal_id = evidence_id(record)
    headline = record["presentation"]["headline"]
    scale = record["scale"]
    return f'''<article class="entry" id="{esc(signal_id)}" data-signal-path="/signals/{esc(signal_id)}/"><div class="entry-head"><div class="date">{esc(published)} · {esc(source["organization"])}</div><button class="copy-signal-link" type="button" aria-label="Copy Scale Signal link" title="Copy Scale Signal link"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10.6 13.4a4 4 0 0 0 5.7 0l2.1-2.1a4 4 0 0 0-5.7-5.7l-1.2 1.2"></path><path d="M13.4 10.6a4 4 0 0 0-5.7 0l-2.1 2.1a4 4 0 0 0 5.7 5.7l1.2-1.2"></path></svg></button></div><div class="evidence"><h3>{esc(headline)}</h3><div class="meta">{rendered_chips(record)}</div><div class="scale"><strong>{esc(scale["label"])}:</strong> {esc(scale["summary"].strip())}</div><div class="layers"><div class="layer observed"> <b>OBSERVED</b>{rendered_observed(record)}</div><div class="layer"><b>INTERPRETATION</b><p>{esc(record["interpretation"].strip())}</p></div><div class="layer"><b>MODEL IMPLICATION</b><p><strong>{esc(implication["verdict"])}.</strong> {esc(implication["explanation"].strip())}</p></div></div><a class="source" href="{esc(source["url"])}">First-party source ↗</a></div></article>'''


def render_signal_page(record: dict, template: str) -> str:
    source = record["source"]
    implication = record["model_implication"]
    signal_id = evidence_id(record)
    headline = record["presentation"]["headline"]
    published = date.fromisoformat(str(source["date"])).strftime("%B %-d, %Y")
    canonical_url = f"{SITE_ORIGIN}/signals/{signal_id}/"
    description = " ".join(str(record["scale"]["summary"]).split())
    boundaries = "".join(f"<li>{esc(str(item).strip())}</li>" for item in record["what_this_does_not_establish"])
    replacements = {
        "{{TITLE}}": esc(f"{headline} · Scale Signal"),
        "{{HEADLINE}}": esc(headline),
        "{{DESCRIPTION}}": esc(description),
        "{{CANONICAL_URL}}": esc(canonical_url),
        "{{PUBLISHED}}": esc(published),
        "{{ORGANIZATION}}": esc(source["organization"]),
        "{{CHIPS}}": rendered_chips(record),
        "{{SCALE_LABEL}}": esc(record["scale"]["label"]),
        "{{SCALE_SUMMARY}}": esc(record["scale"]["summary"].strip()),
        "{{OBSERVED}}": rendered_observed(record),
        "{{INTERPRETATION}}": esc(record["interpretation"].strip()),
        "{{VERDICT}}": esc(implication["verdict"]),
        "{{IMPLICATION}}": esc(implication["explanation"].strip()),
        "{{BOUNDARIES}}": boundaries,
        "{{OPEN_QUESTION}}": esc(record["open_question"].strip()),
        "{{SOURCE_TITLE}}": esc(source["title"]),
        "{{SOURCE_URL}}": esc(source["url"]),
        "{{SIGNAL_ID}}": esc(signal_id),
    }
    page = template
    for placeholder, value in replacements.items():
        page = page.replace(placeholder, value)
    return page


def clear_generated_signal_pages() -> None:
    if not SIGNALS_DIR.exists():
        return
    for child in SIGNALS_DIR.iterdir():
        generated_page = child / "index.html"
        if child.is_dir() and generated_page.exists():
            if GENERATED_MARKER in generated_page.read_text(encoding="utf-8"):
                shutil.rmtree(child)


def build_signal_pages(records: list[dict]) -> None:
    template = SIGNAL_TEMPLATE.read_text(encoding="utf-8")
    SIGNALS_DIR.mkdir(exist_ok=True)
    clear_generated_signal_pages()
    for record in records:
        output_dir = SIGNALS_DIR / evidence_id(record)
        output_dir.mkdir()
        (output_dir / "index.html").write_text(render_signal_page(record, template), encoding="utf-8")


def update_sitemap(records: list[dict]) -> None:
    sitemap = SITEMAP.read_text(encoding="utf-8")
    if sitemap.count(SITEMAP_START) != 1 or sitemap.count(SITEMAP_END) != 1:
        raise SystemExit("sitemap.xml must contain exactly one Scale Signal URL boundary")
    urls = "\n".join(
        f"  <url>\n    <loc>{SITE_ORIGIN}/signals/{evidence_id(record)}/</loc>\n  </url>"
        for record in records
    )
    before, remainder = sitemap.split(SITEMAP_START, 1)
    _, after = remainder.split(SITEMAP_END, 1)
    SITEMAP.write_text(before + SITEMAP_START + "\n" + urls + "\n  " + SITEMAP_END + after, encoding="utf-8")


def main() -> None:
    records = load_records()
    template = TEMPLATE.read_text(encoding="utf-8")
    entries = "\n".join(render_entry(record) for record in records)
    OUTPUT.write_text(template.replace("{{EVIDENCE_ENTRIES}}", entries), encoding="utf-8")
    build_signal_pages(records)
    update_sitemap(records)
    print(f"Built {OUTPUT.relative_to(ROOT)} and {len(records)} Scale Signal pages")


if __name__ == "__main__":
    main()
