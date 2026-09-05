#!/usr/bin/env python3
"""Build the homepage Evidence Landscape from canonical YAML records."""
from __future__ import annotations

import html
from datetime import date
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE_DIR = ROOT / "evidence"
INDEX = ROOT / "index.html"
GRID_START = "<!-- HOMEPAGE_EVIDENCE_START -->"
GRID_END = "<!-- HOMEPAGE_EVIDENCE_END -->"
MAX_ROWS = 24
STAGES = ["Apparition", "Mutation", "Selection", "Cooperation", "Specialization"]
CONDITIONS = ["Context", "Execution", "Verification", "Coordination", "Observability", "Economics", "Learning"]


def text(value: object) -> str:
    return html.escape(str(value), quote=False)


def attr(value: object) -> str:
    return html.escape(str(value), quote=True)


def load_records() -> list[dict]:
    records = []
    for path in EVIDENCE_DIR.glob("*.yaml"):
        with path.open(encoding="utf-8") as handle:
            record = yaml.safe_load(handle)
        record["_id"] = path.stem
        records.append(record)
    return sorted(records, key=lambda record: str(record["source"]["date"]), reverse=True)


def short_date(value: object) -> str:
    published = date.fromisoformat(str(value))
    return f"{published.strftime('%b').upper()} {published.day}"


def date_range(records: list[dict]) -> str:
    ordered = sorted(records, key=lambda record: str(record["source"]["date"]))
    first = date.fromisoformat(str(ordered[0]["source"]["date"]))
    last = date.fromisoformat(str(ordered[-1]["source"]["date"]))
    if first.year == last.year:
        return f"{first.strftime('%b')}–{last.strftime('%b')} {first.year}"
    return f"{first.strftime('%b')} {first.year}–{last.strftime('%b')} {last.year}"


def count_mapping(records: list[dict], field: str, value: str) -> int:
    return sum(value in record["mapping"][field] for record in records)


def transition_target(record: dict, stage: str) -> bool:
    transition = record["mapping"].get("transition")
    return bool(transition and transition["to"] == stage)


def adjacent_stage(record: dict, stage: str) -> bool:
    transition = record["mapping"].get("transition")
    return bool(transition and transition.get("adjacent_stage") == stage)


def render_stage_cell(record: dict, stage: str) -> str:
    if stage not in record["mapping"]["stages"]:
        return '<span class="landscape-cell" aria-hidden="true"></span>'
    arrow = '<span class="landscape-arrow">→</span>' if transition_target(record, stage) else ""
    marker = "landscape-ring" if adjacent_stage(record, stage) else "landscape-dot"
    return f'<span class="landscape-cell" aria-hidden="true">{arrow}<i class="{marker}"></i></span>'


def render_condition_cell(record: dict, condition: str) -> str:
    marker = '<i class="landscape-square"></i>' if condition in record["mapping"]["conditions"] else ""
    return f'<span class="landscape-cell" aria-hidden="true">{marker}</span>'


def render_row(record: dict) -> str:
    signal_id = str(record["_id"])
    source = record["source"]
    presentation = record["presentation"]
    scale = record["scale"]
    verdict = str(record["model_implication"]["verdict"])
    tooltip = f'{presentation["headline"]} — {scale["label"]}: {" ".join(str(scale["summary"]).split())}'
    stages = "".join(render_stage_cell(record, stage) for stage in STAGES)
    conditions = "".join(render_condition_cell(record, condition) for condition in CONDITIONS)
    return (
        f'<a class="landscape-row" href="signals/{attr(signal_id)}/" title="{attr(tooltip)}">'
        f'<span class="landscape-source"><span class="landscape-date">{short_date(source["date"])}</span>'
        f'<strong>{text(source["producer"])}</strong></span>'
        f'{stages}<span class="landscape-divider" aria-hidden="true"></span>{conditions}'
        f'<span class="landscape-verdict {attr(verdict.lower())}">{text(verdict)}</span></a>'
    )


def render_chart(records: list[dict]) -> str:
    visible = records[:MAX_ROWS]
    if not visible:
        raise SystemExit("At least one evidence record is required for the homepage landscape")
    if len(records) <= MAX_ROWS:
        subtitle = f"{len(visible)} accepted evidence records · {date_range(visible)}"
    else:
        subtitle = f"{len(visible)} of {len(records)} accepted evidence records · {date_range(visible)}"

    stage_headers = "".join(
        f'<span class="landscape-column-label"><b>{text(stage)}</b><small>{count_mapping(visible, "stages", stage)}</small></span>'
        for stage in STAGES
    )
    condition_headers = "".join(
        f'<span class="landscape-column-label"><b>{text(condition)}</b><small>{count_mapping(visible, "conditions", condition)}</small></span>'
        for condition in CONDITIONS
    )
    rows = "".join(render_row(record) for record in visible)

    return (
        '<div class="landscape-card"><div class="landscape-card-head"><div>'
        f'<strong>Scale Signal Landscape</strong><span>{text(subtitle)}</span></div></div>'
        '<div class="landscape-scroll"><div class="landscape-matrix">'
        '<div class="landscape-groups"><span></span><b class="landscape-model-group">Evolutionary model</b>'
        '<span></span><b class="landscape-conditions-group">Selection conditions</b>'
        '<b class="landscape-implication-group">Model implication</b></div>'
        f'<div class="landscape-columns"><span></span>{stage_headers}'
        f'<span class="landscape-divider" aria-hidden="true"></span>{condition_headers}<span></span></div>'
        f'{rows}</div></div>'
        '<div class="landscape-legend"><span><i class="landscape-dot"></i> stage mapped</span>'
        '<span><i class="landscape-ring"></i> adjacent stage signal</span>'
        '<span><i class="landscape-square"></i> Selection condition mapped</span>'
        '<span>→ explicit transition in canonical evidence mapping</span>'
        '<span><b>SUPPORTS / REFINES</b> model implication</span></div></div>'
    )


def main() -> None:
    index_html = INDEX.read_text(encoding="utf-8")
    if index_html.count(GRID_START) != 1 or index_html.count(GRID_END) != 1:
        raise SystemExit("index.html must contain exactly one homepage evidence landscape boundary")

    # v0.2.2 changes the canonical evidence mapping while the public homepage is
    # intentionally still the v0.1 model. Keep that v0.1 landscape stable until
    # the public-model migration updates the stage vocabulary in v0.2.4.
    if "Working model · v0.1" in index_html:
        print("Kept v0.1 homepage Evidence Landscape unchanged during v0.2 evidence remapping")
        return

    records = load_records()
    generated = render_chart(records)
    before, remainder = index_html.split(GRID_START, 1)
    _, after = remainder.split(GRID_END, 1)
    INDEX.write_text(before + GRID_START + generated + GRID_END + after, encoding="utf-8")
    print(f"Built homepage Evidence Landscape from {min(len(records), MAX_ROWS)} of {len(records)} accepted records")


if __name__ == "__main__":
    main()
