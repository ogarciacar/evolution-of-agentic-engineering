#!/usr/bin/env python3
"""Verify canonical evidence-to-claim mappings survive deterministic projection."""
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
MAPPINGS = yaml.safe_load((ROOT / "model" / "evidence-claims.yaml").read_text(encoding="utf-8"))["mappings"]


def main() -> None:
    with tempfile.TemporaryDirectory() as directory:
        database = Path(directory) / "evidence.db"
        subprocess.run([sys.executable, str(ROOT / "scripts" / "index-evidence.py"), "--database", str(database)], check=True)
        connection = sqlite3.connect(database)
        rows = connection.execute(
            "SELECT evidence_id, claim_id, relationship FROM evidence_claims ORDER BY evidence_id, claim_id"
        ).fetchall()

    expected = sorted(
        (evidence_id, item["id"], item["relationship"])
        for evidence_id, items in MAPPINGS.items()
        for item in items
    )
    assert rows == expected
    print(f"Evidence claim projection preserves {len(rows)} explicit relationships")


if __name__ == "__main__":
    main()
