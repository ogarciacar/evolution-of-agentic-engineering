#!/usr/bin/env python3
"""Require new evidence records in pull requests to carry their own claim relationships."""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]


def added_evidence(base_ref: str) -> list[Path]:
    result = subprocess.run(
        ["git", "diff", "--diff-filter=A", "--name-only", f"origin/{base_ref}...HEAD", "--", "evidence/*.yaml"],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return [ROOT / line for line in result.stdout.splitlines() if line]


def main() -> int:
    base_ref = os.environ.get("GITHUB_BASE_REF")
    if not base_ref:
        print("Atomic evidence contribution check skipped outside a pull request")
        return 0

    failures = 0
    files = added_evidence(base_ref)
    for path in files:
        record = yaml.safe_load(path.read_text(encoding="utf-8"))
        claims = record.get("claims") if isinstance(record, dict) else None
        if not claims:
            failures += 1
            print(
                f"{path.relative_to(ROOT)}: new evidence must declare non-empty claims in the canonical evidence YAML",
                file=sys.stderr,
            )

    if failures:
        print(f"Atomic evidence contribution check failed with {failures} error(s)", file=sys.stderr)
        return 1

    print(f"Atomic evidence contribution contract satisfied for {len(files)} new evidence record(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
