#!/usr/bin/env python3
"""Regenerate every committed artifact derived from canonical research state.

Run this after changing evidence records or evidence-to-claim mappings and before
opening a pull request. CI remains the verifier: this command only invokes the
existing deterministic generators in their dependency order.
"""

from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent

GENERATORS = (
    "scripts/build-research-frontier.py",
    "scripts/build-evidence.py",
    "scripts/build-model-evaluation.py",
    "scripts/build-homepage-evidence.py",
)


def main() -> int:
    for generator in GENERATORS:
        print(f"Generating via {generator}")
        subprocess.run([sys.executable, generator], cwd=ROOT, check=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
