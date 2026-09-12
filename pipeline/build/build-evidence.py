#!/usr/bin/env python3
"""Generate evidence-derived sitemap entries from canonical YAML."""
from __future__ import annotations

import re
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE_DIR = ROOT / "evidence"
SITEMAP_TEMPLATE = ROOT / "pipeline" / "templates" / "sitemap.xml"
SITEMAP = ROOT / "sitemap.xml"
SITE_ORIGIN = "https://agenticengineering.science"
SITEMAP_START = "<!-- SCALE_SIGNAL_URLS_START -->"
SITEMAP_END = "<!-- SCALE_SIGNAL_URLS_END -->"
SIGNAL_ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


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


def evidence_id(record: dict) -> str:
    return Path(record["_path"]).stem


def build_sitemap(records: list[dict]) -> str:
    template = SITEMAP_TEMPLATE.read_text(encoding="utf-8")
    if template.count(SITEMAP_START) != 1 or template.count(SITEMAP_END) != 1:
        raise SystemExit("pipeline/templates/sitemap.xml must contain exactly one Scale Signal URL boundary")
    urls = "\n".join(
        f"  <url>\n    <loc>{SITE_ORIGIN}/signals/{evidence_id(record)}/</loc>\n  </url>"
        for record in records
    )
    before, remainder = template.split(SITEMAP_START, 1)
    _, after = remainder.split(SITEMAP_END, 1)
    return before + SITEMAP_START + "\n" + urls + "\n  " + SITEMAP_END + after


def main() -> None:
    records = load_records()
    SITEMAP.write_text(build_sitemap(records), encoding="utf-8")
    print(f"Generated sitemap entries for {len(records)} runtime Scale Signal routes")


if __name__ == "__main__":
    main()
