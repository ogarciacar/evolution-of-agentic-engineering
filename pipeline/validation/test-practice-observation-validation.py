#!/usr/bin/env python3
"""Contract tests for canonical practice-observation YAML validation."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[2]
SCHEMA = json.loads((ROOT / "schema" / "evidence.schema.json").read_text(encoding="utf-8"))
VALIDATOR = Draft202012Validator(SCHEMA)
VALIDATOR_PATH = Path(__file__).with_name("validate-evidence.py")
spec = importlib.util.spec_from_file_location("validate_evidence", VALIDATOR_PATH)
validate_evidence = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(validate_evidence)


def valid_observation(**overrides):
    observation = {
        "id": "lineage",
        "use_case": "Find affected repositories",
        "problem": "The agent must discover downstream consumers",
        "reported_practice": "Use dependency lineage",
        "selection_conditions": ["context"],
    }
    observation.update(overrides)
    return observation


def assert_valid(observation):
    assert list(VALIDATOR.evolve(schema=SCHEMA["$defs"]["practice_observation"]).iter_errors(observation)) == []


def assert_invalid(observation):
    assert list(VALIDATOR.evolve(schema=SCHEMA["$defs"]["practice_observation"]).iter_errors(observation))


def main() -> None:
    assert_valid(valid_observation())
    assert_valid(valid_observation(selection_conditions=["verification", "learning"]))

    for field in ("id", "use_case", "problem", "reported_practice"):
        observation = valid_observation()
        del observation[field]
        assert_invalid(observation)
        assert_invalid(valid_observation(**{field: ""}))

    observation = valid_observation()
    del observation["selection_conditions"]
    assert_invalid(observation)
    assert_invalid(valid_observation(selection_conditions=[]))
    assert_invalid(valid_observation(selection_conditions=["scalability"]))
    assert_invalid(valid_observation(selection_conditions=["context", "context"]))
    assert_invalid(valid_observation(extra_field="not allowed"))

    # The field is optional at evidence-record level, preserving existing corpus records.
    assert "practice_observations" not in SCHEMA["required"]

    duplicate_record = {"practice_observations": [valid_observation(), valid_observation(problem="Another problem")]}
    assert validate_evidence.duplicate_practice_observation_ids(duplicate_record) == ["lineage"]
    distinct_record = {
        "practice_observations": [valid_observation(), valid_observation(id="repair-loop")]
    }
    assert validate_evidence.duplicate_practice_observation_ids(distinct_record) == []

    print("Practice observation validation contract passed")


if __name__ == "__main__":
    main()
