#!/usr/bin/env python3
"""Build research synthesis from canonical, traceable findings."""
from pathlib import Path
import html
import yaml

ROOT = Path(__file__).resolve().parents[2]
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
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Research synthesis — Evolution of Agentic Engineering</title><link rel="icon" href="/favicon.ico" sizes="any"/><link rel="icon" type="image/svg+xml" href="/assets/favicon.svg"/><link rel="apple-touch-icon" href="/assets/logo.png"/><link rel="stylesheet" href="/assets/brand.css"/><style>
:root{{--bg:#f7f7f5;--ink:#171719;--muted:#66666f;--line:#d9d9dc;--card:#fff;--accent:#6c4cff;--soft:#eeeaff}}*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,sans-serif;line-height:1.45}}a{{color:inherit}}button{{font:inherit}}main{{max-width:1180px;margin:auto;padding:24px 28px 96px}}.eyebrow,.meta{{font-size:13px;font-weight:750;letter-spacing:.12em;text-transform:uppercase;color:var(--accent)}}h1{{font-size:clamp(46px,7vw,82px);line-height:.96;letter-spacing:-.055em;margin:18px 0 28px}}h2{{font-size:clamp(28px,4vw,42px);line-height:1.05;letter-spacing:-.035em;margin:10px 0 20px}}.lead{{font-size:clamp(19px,2vw,27px);max-width:900px;color:#35353b}}.topnav{{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:0 0 24px;position:relative}}.brand{{font-weight:850;text-decoration:none;letter-spacing:-.02em}}.navlinks{{display:flex;align-items:center;gap:22px;flex-wrap:wrap;justify-content:flex-end}}.navlinks a{{font-size:13px;font-weight:750;text-decoration:none;border-bottom:1px solid transparent}}.navlinks a:hover{{border-bottom-color:#aaa}}.navlinks a[aria-current="page"]{{color:var(--accent);border-bottom-color:var(--accent)}}.nav-toggle{{display:none;appearance:none;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--ink);width:42px;height:38px;align-items:center;justify-content:center;font-size:22px;line-height:1;cursor:pointer}}.nav-toggle:focus-visible{{outline:2px solid var(--accent);outline-offset:2px}}.research-context{{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:14px 0 32px;border-top:1px solid var(--line)}}.research-context-root{{font-size:13px;font-weight:750;text-decoration:none}}.research-context-links{{display:flex;gap:18px;flex-wrap:wrap;justify-content:flex-end}}.context-link{{font-size:13px;font-weight:750;text-decoration:none;border-bottom:1px solid #aaa}}.context-link[aria-current="page"]{{color:var(--accent);border-bottom-color:var(--accent)}}header{{padding-bottom:70px;border-bottom:1px solid var(--line)}}.loop{{margin:28px 0 0;color:var(--muted);font-size:13px;font-weight:750;letter-spacing:.02em}}.loop strong{{color:var(--accent)}}.findings{{display:grid;gap:18px;padding-top:70px;padding-bottom:70px;border-bottom:1px solid var(--line)}}.finding{{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:30px}}.meta{{font-size:12px;letter-spacing:.1em}}.statement{{font-size:19px;max-width:850px}}.uncertainty{{margin-top:26px;padding:20px;background:var(--soft);border-radius:14px}}.uncertainty p{{margin-bottom:0}}details{{margin-top:20px}}summary{{cursor:pointer;font-weight:750}}li{{margin:7px 0}}footer{{padding-top:36px;color:var(--muted);font-size:13px}}@media(max-width:700px){{main{{padding:18px 22px 64px}}.topnav{{padding-bottom:24px}}.brand{{font-size:17px}}.nav-toggle{{display:inline-flex;flex:0 0 auto}}.navlinks{{display:none;position:absolute;z-index:20;top:46px;right:0;min-width:190px;padding:8px;border:1px solid var(--line);border-radius:14px;background:var(--card);box-shadow:0 14px 36px rgba(23,23,25,.12);flex-direction:column;align-items:stretch;gap:0}}.navlinks.open{{display:flex}}.navlinks a{{font-size:14px;padding:10px 12px;border-bottom:0;border-radius:9px}}.navlinks a:hover,.navlinks a:focus-visible{{background:var(--soft);outline:none}}.navlinks a[aria-current="page"]{{background:var(--soft);color:var(--accent)}}.research-context{{align-items:flex-start;flex-direction:column;padding:12px 0 28px}}.research-context-links{{justify-content:flex-start;gap:14px}}header{{padding-bottom:54px}}.findings{{padding-top:54px;padding-bottom:54px}}.eyebrow{{font-size:11px;line-height:1.35}}h1{{font-size:clamp(42px,13vw,58px);line-height:.94;margin:14px 0 22px;overflow-wrap:anywhere}}.lead{{font-size:18px;line-height:1.45}}.finding{{padding:22px}}}}
</style></head><body><main>
<nav class="topnav" aria-label="Primary"><a class="brand" href="/" aria-label="AgenticEngineering.science home"><img class="brand-mark" src="/assets/logo.svg" alt="" width="30" height="36"/><span>AgenticEngineering.science</span></a><button class="nav-toggle" type="button" aria-expanded="false" aria-controls="primary-links" aria-label="Open navigation menu">☰</button><div class="navlinks" id="primary-links"><a href="/evidence" aria-current="page">Evidence</a><a href="/model">Model</a><a href="/signals">Signals</a><a href="/practices">Practices</a><a href="/about">About</a></div></nav>
<div class="research-context"><a class="research-context-root" href="/evidence">Evidence log · v0.2</a><div class="research-context-links"><a class="context-link" href="/evaluate">Evaluation →</a><a class="context-link" href="/synthesis" aria-current="page">Synthesis →</a><a class="context-link" href="/apply">Apply →</a></div></div>
<header><div class="eyebrow">Synthesis</div><h1>What is the accumulated evidence telling us?</h1><p class="lead">Traceable interpretations across the incorporated evidence corpus. Findings are working research conclusions, not new facts: each remains connected to its supporting records and exposes what the corpus still cannot establish.</p><p class="loop">Model → Evidence → Evaluation → <strong>Synthesis</strong> → Research frontier</p></header>
<section class="findings">{body}</section>
<footer>Evolution of Agentic Engineering · Research synthesis · v0.2 · September 2026</footer>
</main><script>(()=>{{const t=document.querySelector(".nav-toggle"),n=document.getElementById("primary-links");if(!t||!n)return;const c=()=>{{n.classList.remove("open");t.setAttribute("aria-expanded","false");t.setAttribute("aria-label","Open navigation menu")}};t.addEventListener("click",e=>{{e.stopPropagation();const o=n.classList.toggle("open");t.setAttribute("aria-expanded",String(o));t.setAttribute("aria-label",o?"Close navigation menu":"Open navigation menu")}});n.addEventListener("click",e=>{{e.target.closest("a")&&c()}});document.addEventListener("click",e=>{{!n.contains(e.target)&&!t.contains(e.target)&&c()}});document.addEventListener("keydown",e=>{{if(e.key==="Escape"){{c();t.focus()}}}})}})();</script></body></html>'''
    OUTPUT.write_text(page, encoding="utf-8")
    print(f"Built synthesis.html from {len(doc['findings'])} traceable findings")


if __name__ == "__main__":
    main()
