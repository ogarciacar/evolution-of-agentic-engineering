#!/usr/bin/env python3
"""Build the public model-evaluation page from canonical research state."""
from __future__ import annotations

import html
import importlib.util
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "evaluate.html"
TEMPLATE = ROOT / "templates" / "evaluate.html"
EVALUATOR = ROOT / "scripts" / "evaluate-model-claims.py"
RESEARCH_GAPS = ROOT / "model" / "research-gaps.yaml"

spec = importlib.util.spec_from_file_location("evaluate_model_claims", EVALUATOR)
module = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(module)


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def render_claim(claim: dict, stage_number: int, gap: dict) -> str:
    status_class = " unobserved" if claim["status"] == "UNOBSERVED" else ""
    counts = claim["relationship_counts"]
    if claim["evidence_count"] == 0:
        evidence = '<strong>No incorporated evidence currently bears directly on this claim.</strong><p class="rule">This is an evidence gap, not evidence against the claim.</p>'
    else:
        noun = "record" if claim["evidence_count"] == 1 else "records"
        count_line = " · ".join(f'{counts[key]} {key}' for key in ("SUPPORTS", "REFINES", "CONTRADICTS", "INCONCLUSIVE"))
        links = "".join(
            f'<li><a href="signals/{esc(item["evidence_id"])}/">{esc(item["evidence_id"])}</a><span class="relation">{esc(item["relationship"])}</span></li>'
            for item in claim["evidence"]
        )
        evidence = f'<strong>{claim["evidence_count"]} mapped {noun}</strong><p class="rule">{esc(count_line)}</p><details><summary>Inspect mapped evidence</summary><ul>{links}</ul></details>'
    needed = "".join(f'<li>{esc(item)}</li>' for item in gap["evidence_needed"])
    research_gap = (
        '<div class="research-gap"><span class="gap-label">What would resolve this?</span>'
        f'<p>{esc(gap["question"])}</p><details><summary>Evidence to look for</summary><ul>{needed}</ul></details></div>'
    )
    return (
        '<article class="claim"><div class="claim-head"><div>'
        f'<span class="claim-id">{stage_number:02d}</span> · <span class="stage">{esc(claim["stage"])}</span>'
        f'<h3>{esc(claim["title"])}</h3></div><span class="status{status_class}">{esc(claim["status"])}</span></div>'
        f'<div class="evidence">{evidence}</div>{research_gap}</article>'
    )


def main() -> None:
    evaluation = module.evaluate()
    gaps_doc = yaml.safe_load(RESEARCH_GAPS.read_text(encoding="utf-8"))
    gaps = {gap["claim_id"]: gap for gap in gaps_doc["research_gaps"]}
    claims = "\n".join(
        render_claim(claim, stage_number, gaps[claim["id"]])
        for stage_number, claim in enumerate(evaluation["claims"], start=1)
    )
    page = TEMPLATE.read_text(encoding="utf-8").replace("{{CLAIMS}}", claims)
    OUTPUT.write_text(page, encoding="utf-8")
    print(f"Built {OUTPUT.relative_to(ROOT)} from {len(evaluation['claims'])} model claims and canonical research gaps")


if __name__ == "__main__":
    main()
