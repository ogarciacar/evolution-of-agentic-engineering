#!/usr/bin/env python3

import json
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[1]
CLAIMS_PATH = ROOT / "model" / "claims.yaml"
SCHEMA_PATH = ROOT / "schema" / "model-claims.schema.json"
EXPECTED_STAGES = ["Apparition", "Mutation", "Selection", "Cooperation", "Specialization"]


def main() -> None:
    claims = yaml.safe_load(CLAIMS_PATH.read_text(encoding="utf-8"))
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))

    errors = sorted(
        Draft202012Validator(schema).iter_errors(claims),
        key=lambda error: list(error.absolute_path),
    )
    if errors:
        for error in errors:
            path = ".".join(str(part) for part in error.absolute_path) or "<root>"
            print(f"{CLAIMS_PATH.relative_to(ROOT)}:{path}: {error.message}")
        raise SystemExit(1)

    records = claims["claims"]
    ids = [record["id"] for record in records]
    if len(ids) != len(set(ids)):
        raise SystemExit("model/claims.yaml: claim ids must be unique")

    stages = [record["stage"] for record in records]
    if stages != EXPECTED_STAGES:
        raise SystemExit(
            "model/claims.yaml: claims must follow the model stage order exactly: "
            + " -> ".join(EXPECTED_STAGES)
        )

    print(f"Validated {len(records)} model claims")


if __name__ == "__main__":
    main()
