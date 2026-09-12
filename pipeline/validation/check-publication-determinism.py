#!/usr/bin/env python3
"""Verify that canonical research state produces stable publication outputs."""
from __future__ import annotations

import hashlib
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
BUILDER = ROOT / "pipeline" / "build-publication.py"
PUBLICATION_OUTPUTS = (
    ROOT / "research-frontier.json",
    ROOT / "evaluate.html",
    ROOT / "synthesis.html",
    ROOT / "sitemap.xml",
)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build() -> None:
    subprocess.run(
        [sys.executable, str(BUILDER.relative_to(ROOT))],
        cwd=ROOT,
        check=True,
    )


def snapshot() -> dict[str, str]:
    missing = [path.name for path in PUBLICATION_OUTPUTS if not path.is_file()]
    if missing:
        raise SystemExit(
            "Publication build did not produce required outputs: " + ", ".join(missing)
        )
    return {path.name: sha256(path) for path in PUBLICATION_OUTPUTS}


def main() -> int:
    build()
    first = snapshot()

    build()
    second = snapshot()

    drift = [name for name in first if first[name] != second[name]]
    if drift:
        for name in drift:
            print(
                f"NONDETERMINISTIC_PUBLICATION {name}: {first[name]} != {second[name]}",
                file=sys.stderr,
            )
        return 1

    print("Publication build is deterministic:")
    for name in sorted(second):
        print(f"  {name} {second[name]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
