#!/usr/bin/env python3
"""Update evidence-derived sitemap entries from canonical YAML."""
from __future__ import annotations

import re
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE_DIR = ROOT / "evidence"
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
    update_sitemap(records)
    print(f"Updated sitemap entries for {len(records)} runtime Scale Signal routes")


if __name__ == "__main__":
    main()
