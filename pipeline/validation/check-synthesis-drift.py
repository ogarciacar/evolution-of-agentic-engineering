#!/usr/bin/env python3
"""Fail when reviewed synthesis no longer matches its semantic dependency state."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
BASELINE = ROOT / "model" / "synthesis-state.json"
STATE_BUILDER = ROOT / "pipeline" / "synthesis-state.py"


def current_state() -> dict:
    spec = importlib.util.spec_from_file_location("synthesis_state", STATE_BUILDER)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader
    spec.loader.exec_module(module)
    return module.build_state()


def main() -> None:
    expected = json.loads(BASELINE.read_text(encoding="utf-8"))
    current = current_state()
    expected_by_id = {item["id"]: item["fingerprint"] for item in expected["findings"]}
    current_by_id = {item["id"]: item["fingerprint"] for item in current["findings"]}

    stale = sorted(
        finding_id
        for finding_id in set(expected_by_id) | set(current_by_id)
        if expected_by_id.get(finding_id) != current_by_id.get(finding_id)
    )
    if stale:
        for finding_id in stale:
            print(
                f"SYNTHESIS_REVIEW_REQUIRED {finding_id}: a claim state, claim definition, or explicitly cited evidence mapping changed since this finding was last reviewed.",
                file=sys.stderr,
            )
        print(
            "Review affected findings in model/synthesis.yaml. If their meaning remains valid, refresh the reviewed semantic baseline with: "
            "python pipeline/synthesis-state.py > model/synthesis-state.json",
            file=sys.stderr,
        )
        raise SystemExit(1)

    print(f"Synthesis current: {len(current_by_id)} findings match reviewed semantic dependency state")


if __name__ == "__main__":
    main()
