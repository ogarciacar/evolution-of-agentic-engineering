#!/usr/bin/env python3
"""Build the curated homepage evidence section from canonical YAML records."""
from __future__ import annotations

import html
from datetime import date
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE_DIR = ROOT / "evidence"
CURATION = ROOT / "curation" / "homepage.yaml"
INDEX = ROOT / "index.html"
START = "<!-- HOMEPAGE_EVIDENCE_START -->"
END = "<!-- HOMEPAGE_EVIDENCE_END -->"


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def load_record(evidence_id: str) -> dict:
    path = EVIDENCE_DIR / f"{evidence_id}.yaml"
    if not path.exists():
        raise SystemExit(f"Curated evidence record does not exist: {path.relative_to(ROOT)}")
    with path.open(encoding="utf-8") as handle:
        return yaml.safe_load(handle)


def published_date(record: dict) -> str:
    published = date.fromisoformat(str(record["source"]["date"]))
    return f"{published.strftime('%b')} {published.day}, {published.year}"


def render_chip(chip: dict) -> str:
    css = "phase hit" if chip.get("hit", False) else "phase"
    return f'<span class="{css}">{esc(chip["label"])}</span>'


def render_card(selection: dict) -> str:
    evidence_id = str(selection["id"])
    record = load_record(evidence_id)
    source = record["source"]
    presentation = record["presentation"]
    summary = presentation.get("summary")
    if not summary:
        raise SystemExit(f"Curated evidence requires presentation.summary: {evidence_id}")

    title = selection.get("title", source["organization"])
    signal = f'{selection["signal"]} · {published_date(record)}'
    chips = "".join(render_chip(chip) for chip in selection.get("chips", []))
    return (
        f'<article class="evidence-card"><div class="signal">{esc(signal)}</div>'
        f'<h3>{esc(title)}</h3><p>{esc(summary)}</p>'
        f'<div class="phase-row">{chips}</div>'
        f'<a class="source-link" href="{esc(source["url"])}" target="_blank" rel="noreferrer">Public evidence ↗</a></article>'
    )


def main() -> None:
    with CURATION.open(encoding="utf-8") as handle:
        curation = yaml.safe_load(handle)
    selections = curation.get("evidence", [])
    if not selections:
        raise SystemExit("curation/homepage.yaml must select at least one evidence record")

    cards = "".join(render_card(selection) for selection in selections)
    generated = f'{START}<div class="evidence-grid">{cards}</div>{END}'

    index_html = INDEX.read_text(encoding="utf-8")
    if START not in index_html or END not in index_html:
        raise SystemExit("index.html is missing homepage evidence generation markers")
    before, remainder = index_html.split(START, 1)
    _, after = remainder.split(END, 1)
    INDEX.write_text(before + generated + after, encoding="utf-8")
    print(f"Built homepage evidence from {len(selections)} curated records")


if __name__ == "__main__":
    main()
