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


def signal_label(record: dict, index: int) -> str:
    published = date.fromisoformat(str(record["source"]["date"])).strftime("%b %-d, %Y")
    implication = record["model_implication"]["verdict"]
    if index == 0:
        prefix = "Latest signal"
    elif implication == "REFINES":
        prefix = "Strong signal · model refinement"
    else:
        prefix = "Strong signal"
    return f"{prefix} · {published}"


def summary(record: dict) -> str:
    observed = record["observed"]
    return " ".join(str(item).strip() for item in observed[:2])


def chip_labels(record: dict) -> list[str]:
    mapping = record["mapping"]
    labels = list(mapping["stages"])
    for condition in mapping["conditions"]:
        if condition not in labels:
            labels.append(condition)
    return labels


def render_card(record: dict, index: int) -> str:
    source = record["source"]
    chips = "".join(f'<span class="phase hit">{esc(label)}</span>' for label in chip_labels(record))
    return (
        f'<article class="evidence-card"><div class="signal">{esc(signal_label(record, index))}</div>'
        f'<h3>{esc(source["organization"])}</h3><p>{esc(summary(record))}</p>'
        f'<div class="phase-row">{chips}</div>'
        f'<a class="source-link" href="{esc(source["url"])}" target="_blank" rel="noreferrer">Public evidence ↗</a></article>'
    )


def main() -> None:
    with CURATION.open(encoding="utf-8") as handle:
        curation = yaml.safe_load(handle)
    evidence_ids = curation.get("evidence", [])
    if not evidence_ids:
        raise SystemExit("curation/homepage.yaml must select at least one evidence record")

    records = [load_record(str(evidence_id)) for evidence_id in evidence_ids]
    cards = "".join(render_card(record, index) for index, record in enumerate(records))
    generated = f'{START}<div class="evidence-grid">{cards}</div>{END}'

    index_html = INDEX.read_text(encoding="utf-8")
    if START not in index_html or END not in index_html:
        raise SystemExit("index.html is missing homepage evidence generation markers")
    before, remainder = index_html.split(START, 1)
    _, after = remainder.split(END, 1)
    INDEX.write_text(before + generated + after, encoding="utf-8")
    print(f"Built homepage evidence from {len(records)} curated records")


if __name__ == "__main__":
    main()
