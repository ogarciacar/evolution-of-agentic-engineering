#!/usr/bin/env python3
"""Build research synthesis from canonical, traceable findings."""
from pathlib import Path
import html
import yaml

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "model" / "synthesis.yaml"
GAPS = ROOT / "model" / "research-gaps.yaml"
OUTPUT = ROOT / "synthesis.html"


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def main() -> None:
    doc = yaml.safe_load(SOURCE.read_text(encoding="utf-8"))
    gaps_doc = yaml.safe_load(GAPS.read_text(encoding="utf-8"))
    gaps = {gap["claim_id"]: gap for gap in gaps_doc["research_gaps"]}
    cards = []
    for finding in doc["findings"]:
        evidence = "".join(
            f'<li><a href="signals/{esc(eid)}/">{esc(eid)}</a></li>'
            for eid in finding["evidence"]
        )
        claims = " · ".join(esc(cid) for cid in finding.get("claims", []))
        frontier = "".join(
            f'<li><strong>{esc(cid)}</strong> — {esc(gaps[cid]["question"])}</li>'
            for cid in finding.get("claims", []) if cid in gaps
        )
        cards.append(
            '<article class="finding">'
            f'<div class="meta">{esc(finding["id"])} · {claims}</div>'
            f'<h2>{esc(finding["title"])}</h2>'
            f'<p class="statement">{esc(finding["statement"])}</p>'
            '<div class="uncertainty"><strong>What remains uncertain</strong>'
            f'<p>{esc(finding["uncertainty"])}</p></div>'
            f'<details><summary>Trace to evidence</summary><ul>{evidence}</ul></details>'
            f'<details><summary>Continue at the research frontier</summary><ul>{frontier}</ul></details>'
            '</article>'
        )
    body = "\n".join(cards)
    page = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Research synthesis — Evolution of Agentic Engineering</title><style>
:root{{--bg:#f7f7f5;--ink:#171719;--muted:#66666f;--line:#d9d9dc;--card:#fff;--accent:#6c4cff;--soft:#eeeaff}}*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,sans-serif;line-height:1.5}}main{{max-width:1100px;margin:auto;padding:56px 28px 96px}}a{{color:inherit}}nav{{display:flex;justify-content:space-between;padding-bottom:42px}}.eyebrow,.meta{{font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--accent)}}nav a{{font-size:13px;font-weight:750;text-decoration:none;border-bottom:1px solid #aaa}}h1{{font-size:clamp(48px,7vw,82px);line-height:.96;letter-spacing:-.055em;margin:18px 0 28px}}.lead{{font-size:clamp(19px,2vw,27px);max-width:900px;color:#35353b;margin-bottom:70px}}.loop{{margin:-38px 0 54px;color:var(--muted);font-size:13px;font-weight:750;letter-spacing:.02em}}.loop strong{{color:var(--accent)}}.findings{{display:grid;gap:18px}}.finding{{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:30px}}h2{{font-size:clamp(28px,4vw,42px);line-height:1.05;letter-spacing:-.035em;margin:10px 0 20px}}.statement{{font-size:19px;max-width:850px}}.uncertainty{{margin-top:26px;padding:20px;background:var(--soft);border-radius:14px}}.uncertainty p{{margin-bottom:0}}details{{margin-top:20px}}summary{{cursor:pointer;font-weight:750}}li{{margin:7px 0}}footer{{padding-top:50px;color:var(--muted);font-size:13px}}@media(max-width:700px){{nav{{gap:20px;align-items:flex-start}}}}
</style></head><body><main>
<nav><span class="eyebrow">Research synthesis · v0.2</span><span><a href="evaluate.html">← Evaluation</a>&nbsp;&nbsp;&nbsp;<a href="evidence.html">Evidence</a>&nbsp;&nbsp;&nbsp;<a href="index.html">Model</a></span></nav>
<header><div class="eyebrow">What is the accumulated evidence telling us?</div><h1>Research synthesis</h1><p class="lead">Traceable interpretations across the incorporated evidence corpus. Findings are working research conclusions, not new facts: each remains connected to its supporting records and exposes what the corpus still cannot establish.</p><p class="loop">Model → Evidence → Evaluation → <strong>Synthesis</strong> → Research frontier</p></header>
<section class="findings">{body}</section>
<footer>Evolution of Agentic Engineering · Research synthesis · v0.2 · September 2026</footer>
</main></body></html>'''
    OUTPUT.write_text(page, encoding="utf-8")
    print(f"Built synthesis.html from {len(doc['findings'])} traceable findings")


if __name__ == "__main__":
    main()
