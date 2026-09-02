#!/usr/bin/env python3
"""Build evidence.html from the canonical YAML evidence records."""
from __future__ import annotations

import html
from datetime import date
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE_DIR = ROOT / "evidence"
OUTPUT = ROOT / "evidence.html"
TEMPLATE = ROOT / "templates" / "evidence.html"


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def load_records() -> list[dict]:
    records = []
    for path in EVIDENCE_DIR.glob("*.yaml"):
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


def render_entry(record: dict) -> str:
    source = record["source"]
    mapping = record["mapping"]
    implication = record["model_implication"]
    published = date.fromisoformat(str(source["date"])).strftime("%B %-d, %Y")
    evidence_id = Path(record["_path"]).stem
    headline = record["presentation"]["headline"]

    chips = []
    transition = transition_label(mapping)
    if transition:
        chips.append(f'<span class="chip transition">{esc(transition)}</span>')
    else:
        chips.extend(f'<span class="chip transition">{esc(stage)}</span>' for stage in mapping["stages"])
    chips.extend(f'<span class="chip">{esc(condition)}</span>' for condition in mapping["conditions"])

    observed = "".join(f'<p>{esc(str(item).strip())}</p>' for item in record["observed"])
    scale = record["scale"]
    return f'''<article class="entry" id="{esc(evidence_id)}"><div class="entry-head"><div class="date">{esc(published)} · {esc(source["organization"])}</div><button class="copy-signal-link" type="button" aria-label="Copy Scale Signal link" title="Copy Scale Signal link"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10.6 13.4a4 4 0 0 0 5.7 0l2.1-2.1a4 4 0 0 0-5.7-5.7l-1.2 1.2"></path><path d="M13.4 10.6a4 4 0 0 0-5.7 0l-2.1 2.1a4 4 0 0 0 5.7 5.7l1.2-1.2"></path></svg></button></div><div class="evidence"><h3>{esc(headline)}</h3><div class="meta">{"".join(chips)}</div><div class="scale"><strong>{esc(scale["label"])}:</strong> {esc(scale["summary"].strip())}</div><div class="layers"><div class="layer observed"> <b>OBSERVED</b>{observed}</div><div class="layer"><b>INTERPRETATION</b><p>{esc(record["interpretation"].strip())}</p></div><div class="layer"><b>MODEL IMPLICATION</b><p><strong>{esc(implication["verdict"])}.</strong> {esc(implication["explanation"].strip())}</p></div></div><a class="source" href="{esc(source["url"])}">First-party source ↗</a></div></article>'''


def main() -> None:
    records = load_records()
    template = TEMPLATE.read_text(encoding="utf-8")
    entries = "\n".join(render_entry(record) for record in records)
    OUTPUT.write_text(template.replace("{{EVIDENCE_ENTRIES}}", entries), encoding="utf-8")
    print(f"Built {OUTPUT.relative_to(ROOT)} from {len(records)} evidence records")


if __name__ == "__main__":
    main()
