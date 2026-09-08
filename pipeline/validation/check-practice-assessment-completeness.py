#!/usr/bin/env python3
"""Require every canonical evidence record to be assessed for practice observations."""
from __future__ import annotations

import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE_DIR = ROOT / "evidence"


def assessment_status(record: object) -> str:
    if not isinstance(record, dict):
        return "pending"
    assessment = record.get("practice_assessment")
    if not isinstance(assessment, dict):
        return "pending"
    status = assessment.get("status")
    return status if isinstance(status, str) else "pending"


def pending_evidence(paths: list[Path]) -> list[Path]:
    pending: list[Path] = []
    for path in paths:
        record = yaml.safe_load(path.read_text(encoding="utf-8"))
        if assessment_status(record) != "assessed":
            pending.append(path)
    return pending


def main() -> int:
    files = sorted(EVIDENCE_DIR.glob("*.yaml"))
    if not files:
        print("No evidence YAML records found", file=sys.stderr)
        return 1

    pending = pending_evidence(files)
    assessed = len(files) - len(pending)

    if pending:
        print("Practice observation assessment incomplete", file=sys.stderr)
        print(f"Evidence records: {len(files)}", file=sys.stderr)
        print(f"Assessed:         {assessed}", file=sys.stderr)
        print(f"Pending:          {len(pending)}", file=sys.stderr)
        print("", file=sys.stderr)
        print("Pending evidence:", file=sys.stderr)
        for path in pending:
            print(f"- {path.stem}", file=sys.stderr)
        print("", file=sys.stderr)
        print(
            "Every canonical evidence record must be explicitly assessed before the evidence corpus can be published.",
            file=sys.stderr,
        )
        return 1

    print(f"Practice observation assessment complete: {assessed}/{len(files)} assessed, 0 pending")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
