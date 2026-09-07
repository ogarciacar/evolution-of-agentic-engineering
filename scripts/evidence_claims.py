#!/usr/bin/env python3
"""Resolve evidence-to-claim relationships from canonical evidence or the legacy ledger."""
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE_DIR = ROOT / "evidence"
LEGACY_MAPPINGS_PATH = ROOT / "model" / "evidence-claims.yaml"


def load_legacy_mappings() -> dict[str, list[dict[str, str]]]:
    document = yaml.safe_load(LEGACY_MAPPINGS_PATH.read_text(encoding="utf-8"))
    return document["mappings"]


def relationships_for(path: Path, legacy_mappings: dict[str, list[dict[str, str]]] | None = None) -> list[dict[str, str]]:
    record = yaml.safe_load(path.read_text(encoding="utf-8"))
    embedded = record.get("claims")
    if embedded is not None:
        return embedded
    mappings = legacy_mappings if legacy_mappings is not None else load_legacy_mappings()
    return mappings[path.stem]


def all_relationships() -> dict[str, list[dict[str, str]]]:
    legacy_mappings = load_legacy_mappings()
    return {
        path.stem: relationships_for(path, legacy_mappings)
        for path in sorted(EVIDENCE_DIR.glob("*.yaml"))
    }
