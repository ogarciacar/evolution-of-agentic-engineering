#!/usr/bin/env python3
"""Contract tests for practice-observation assessment completeness."""
from __future__ import annotations

import importlib.util
import tempfile
from pathlib import Path

CHECK_PATH = Path(__file__).with_name("check-practice-assessment-completeness.py")
spec = importlib.util.spec_from_file_location("check_practice_assessment_completeness", CHECK_PATH)
check = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(check)


def write_record(directory: Path, name: str, body: str) -> Path:
    path = directory / name
    path.write_text(body, encoding="utf-8")
    return path


def main() -> None:
    assert check.assessment_status({"practice_assessment": {"status": "assessed"}}) == "assessed"
    assert check.assessment_status({"practice_assessment": {"status": "pending"}}) == "pending"
    assert check.assessment_status({}) == "pending"

    with tempfile.TemporaryDirectory() as temp_dir:
        directory = Path(temp_dir)
        assessed_with_observations = write_record(
            directory,
            "assessed-with-observations.yaml",
            "practice_assessment:\n  status: assessed\npractice_observations:\n  - id: example\n",
        )
        assessed_zero = write_record(
            directory,
            "assessed-zero.yaml",
            "practice_assessment:\n  status: assessed\n",
        )
        pending = write_record(
            directory,
            "pending.yaml",
            "practice_assessment:\n  status: pending\n",
        )
        omitted = write_record(directory, "omitted.yaml", "source:\n  title: Example\n")

        assert check.pending_evidence([assessed_with_observations, assessed_zero]) == []
        assert check.pending_evidence([assessed_with_observations, pending]) == [pending]
        assert check.pending_evidence([omitted]) == [omitted]
        assert check.pending_evidence([assessed_zero, pending, omitted]) == [pending, omitted]

    print("Practice assessment completeness contract passed")


if __name__ == "__main__":
    main()
