#!/usr/bin/env python3
"""Build the deterministic publication surfaces from canonical research state.

This is the stable entrypoint shared by CI and the Cloudflare Pages build. It is
intentionally separate from contribution authoring: evidence/model files are the
canonical inputs, while the generated publication files are rebuildable outputs.
"""

from __future__ import annotations

import hashlib
import json
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
PUBLICATION_MANIFEST = ROOT / "publication-manifest.json"
MANIFEST_VERSION = 1


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_publication_manifest() -> None:
    payload = {
        "version": MANIFEST_VERSION,
        "generator": "pipeline/build-publication.py",
        "artifacts": {
            path.name: {"sha256": sha256(path), "bytes": path.stat().st_size}
            for path in DERIVED_ARTIFACTS
        },
    }
    PUBLICATION_MANIFEST.write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
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

    write_publication_manifest()

    print("Publication build complete:")
    for path in DERIVED_ARTIFACTS:
        print(f"  {path.relative_to(ROOT)}")
    print(f"  {PUBLICATION_MANIFEST.relative_to(ROOT)} (build-only manifest)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
