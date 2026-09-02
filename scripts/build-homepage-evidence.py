#!/usr/bin/env python3
"""Build the curated homepage evidence grid from canonical YAML records."""
from __future__ import annotations

import html
from datetime import date
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE_DIR = ROOT / "evidence"
CURATION = ROOT / "curation" / "homepage.yaml"
INDEX = ROOT / "index.html"
GRID_START = '<div class="evidence-grid">'
GRID_AFTER = '<div class="falsify evidence-note">'


def text(value: object) -> str:
    return html.escape(str(value), quote=False)


def attr(value: object) -> str:
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


def transition_label(mapping: dict) -> str | None:
    transition = mapping.get("transition")
    if not transition:
        return None
    label = f'{transition["from"]} → {transition["to"]}'
    adjacent = transition.get("adjacent_stage")
    if adjacent:
        label += f" / {adjacent}"
    return label


def render_mapping_chips(record: dict) -> str:
    mapping = record["mapping"]
    labels = []
    transition = transition_label(mapping)
    if transition:
        labels.append(transition)
    else:
        labels.extend(mapping["stages"])
    labels.extend(mapping["conditions"])
    return "".join(f'<span class="phase hit">{text(label)}</span>' for label in labels)


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
    chips = render_mapping_chips(record)
    return (
        f'<article class="evidence-card"><div class="signal">{text(signal)}</div>'
        f'<h3>{text(title)}</h3><p>{text(summary)}</p>'
        f'<div class="phase-row">{chips}</div>'
        f'<a class="source-link" href="{attr(source["url"])}" target="_blank" rel="noreferrer">Public evidence ↗</a></article>'
    )


def main() -> None:
    with CURATION.open(encoding="utf-8") as handle:
        curation = yaml.safe_load(handle)
    selections = curation.get("evidence", [])
    if not selections:
        raise SystemExit("curation/homepage.yaml must select at least one evidence record")

    generated = GRID_START + "".join(render_card(selection) for selection in selections) + "</div>"
    index_html = INDEX.read_text(encoding="utf-8")
    if index_html.count(GRID_START) != 1 or index_html.count(GRID_AFTER) != 1:
        raise SystemExit("index.html must contain exactly one homepage evidence grid and boundary")

    before, remainder = index_html.split(GRID_START, 1)
    _, after = remainder.split(GRID_AFTER, 1)
    INDEX.write_text(before + generated + GRID_AFTER + after, encoding="utf-8")
    print(f"Built homepage evidence from {len(selections)} curated records")


if __name__ == "__main__":
    main()
