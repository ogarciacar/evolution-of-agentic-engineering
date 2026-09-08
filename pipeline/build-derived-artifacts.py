#!/usr/bin/env python3
"""Regenerate every committed artifact derived from canonical research state."""

from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent

GENERATORS = (
    "pipeline/build/build-research-frontier.py",
    "pipeline/build/build-evidence.py",
    "pipeline/build/build-model-evaluation.py",
    "pipeline/build/build-research-synthesis.py",
)


def main() -> int:
    for generator in GENERATORS:
        print(f"Generating via {generator}")
        subprocess.run([sys.executable, generator], cwd=ROOT, check=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
