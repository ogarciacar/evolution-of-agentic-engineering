#!/usr/bin/env python3
"""Resolve evidence-to-claim relationships from canonical evidence records."""
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE_DIR = ROOT / "evidence"


def relationships_for(path: Path) -> list[dict[str, str]]:
    record = yaml.safe_load(path.read_text(encoding="utf-8"))
    relationships = record.get("claims")
    if not isinstance(relationships, list) or not relationships:
        raise ValueError(f"{path}: expected non-empty claims list")
    return relationships


def all_relationships() -> dict[str, list[dict[str, str]]]:
    return {
        path.stem: relationships_for(path)
        for path in sorted(EVIDENCE_DIR.glob("*.yaml"))
    }
