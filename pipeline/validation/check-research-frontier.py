#!/usr/bin/env python3
"""Verify that the generated research frontier matches canonical model state."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GENERATOR = ROOT / "pipeline" / "build" / "build-research-frontier.py"
GENERATED = ROOT / "research-frontier.json"


def load_generator():
    spec = importlib.util.spec_from_file_location("research_frontier", GENERATOR)
    if spec is None or spec.loader is None:
        raise RuntimeError("could not load research frontier generator")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main() -> None:
    if not GENERATED.is_file():
        raise SystemExit(
            "research-frontier.json has not been generated; run python pipeline/build-publication.py"
        )

    expected = load_generator().build_frontier()
    generated = json.loads(GENERATED.read_text(encoding="utf-8"))
    if generated != expected:
        raise SystemExit("Generated research-frontier.json does not match canonical model state")
    print("Generated research frontier is aligned with canonical model state")


if __name__ == "__main__":
    main()
