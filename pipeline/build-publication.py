#!/usr/bin/env python3
"""Build the deterministic publication surfaces from canonical research state.

This is the stable entrypoint shared by CI and the Cloudflare Pages build. It is
intentionally separate from contribution authoring: evidence/model files are the
canonical inputs, while the generated publication files are rebuildable outputs.
"""

from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
DERIVED_ARTIFACTS = (
    ROOT / "research-frontier.json",
    ROOT / "evaluate.html",
    ROOT / "synthesis.html",
    ROOT / "sitemap.xml",
)


def main() -> int:
    subprocess.run(
        [sys.executable, "pipeline/build-derived-artifacts.py"],
        cwd=ROOT,
        check=True,
    )

    missing = [path.name for path in DERIVED_ARTIFACTS if not path.is_file()]
    if missing:
        raise SystemExit(
            "Publication build did not produce required artifacts: " + ", ".join(missing)
        )

    print("Publication build complete:")
    for path in DERIVED_ARTIFACTS:
        print(f"  {path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
