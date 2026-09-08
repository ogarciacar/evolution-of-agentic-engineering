#!/usr/bin/env python3
"""Verify that the committed research frontier matches canonical model state."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GENERATOR = ROOT / "pipeline" / "build" / "build-research-frontier.py"
COMMITTED = ROOT / "research-frontier.json"


def load_generator():
    spec = importlib.util.spec_from_file_location("research_frontier", GENERATOR)
    if spec is None or spec.loader is None:
        raise RuntimeError("could not load research frontier generator")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main() -> None:
    generated = load_generator().build_frontier()
    committed = json.loads(COMMITTED.read_text(encoding="utf-8"))
    if committed != generated:
        raise SystemExit("research-frontier.json is stale; run pipeline/build/build-research-frontier.py")
    print("Research frontier is deterministic and aligned with canonical model state")


if __name__ == "__main__":
    main()
