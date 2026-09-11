#!/usr/bin/env python3
"""Run deployed preview smoke tests from CI or a local checkout."""
from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path

from preview_smoke import run_smoke, wait_for_preview

DEFAULT_PROJECT = "evolution-of-agentic-engineering"
SHA_RE = re.compile(r"^[0-9a-f]{12,64}$")


def git(*args: str) -> str:
    try:
        return subprocess.check_output(["git", *args], text=True, stderr=subprocess.STDOUT).strip()
    except subprocess.CalledProcessError as error:
        raise SystemExit(f"git {' '.join(args)} failed:\n{error.output}") from error


def require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise SystemExit(f"Missing required environment variable: {name}")
    return value


def resolve_head_sha(explicit: str | None) -> str:
    value = (explicit or os.environ.get("PR_HEAD_SHA") or git("rev-parse", "HEAD")).strip().lower()
    if not SHA_RE.fullmatch(value):
        raise SystemExit(f"Invalid head SHA: {value!r}")
    return value


def resolve_base_ref(explicit: str | None) -> str:
    return (explicit or os.environ.get("PR_BASE_SHA") or "origin/main").strip()


def added_evidence_paths(base_ref: str, head_sha: str) -> list[Path]:
    output = git("diff", "--name-only", "--diff-filter=A", base_ref, head_sha, "--", "evidence/*.yaml")
    return sorted(Path(line) for line in output.splitlines() if line.strip())


def resolve_smoke_target(base_ref: str, head_sha: str, explicit_evidence_id: str | None) -> tuple[str, bool]:
    evidence_files = sorted(Path("evidence").glob("*.yaml"))
    if not evidence_files:
        raise SystemExit("Evidence corpus is empty. Run from the repository root.")

    added = added_evidence_paths(base_ref, head_sha)
    added_ids = {path.stem for path in added}

    if explicit_evidence_id:
        target = Path("evidence") / f"{explicit_evidence_id}.yaml"
        if not target.is_file():
            raise SystemExit(f"Evidence file does not exist: {target}")
        return explicit_evidence_id, explicit_evidence_id in added_ids

    if added:
        return added[0].stem, True
    return evidence_files[0].stem, False


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(
        description="Smoke-test the deployed Cloudflare Pages preview for the current PR/commit.",
    )
    result.add_argument("--head-sha", help="PR head commit. Defaults to PR_HEAD_SHA or local HEAD.")
    result.add_argument("--base-ref", help="Base SHA/ref used to detect newly added evidence. Defaults to PR_BASE_SHA or origin/main.")
    result.add_argument("--preview-url", help="Atomic Cloudflare preview URL. Skips Pages API discovery when supplied.")
    result.add_argument("--project", default=os.environ.get("CLOUDFLARE_PAGES_PROJECT", DEFAULT_PROJECT))
    result.add_argument("--evidence-id", help="Specific evidence record to smoke-test. Defaults to new evidence or first corpus record.")
    result.add_argument(
        "--timeout",
        type=int,
        default=int(os.environ.get("PREVIEW_SMOKE_TIMEOUT_SECONDS", "600")),
        help="Seconds to wait for Pages deployment / D1 projection readiness (default: 600).",
    )
    return result


def main() -> int:
    args = parser().parse_args()
    if not Path("evidence").is_dir():
        raise SystemExit("Run preview smoke from the repository root")

    head_sha = resolve_head_sha(args.head_sha)
    base_ref = resolve_base_ref(args.base_ref)
    projection_id = head_sha[:12]
    expected_count = len(list(Path("evidence").glob("*.yaml")))
    evidence_id, evidence_is_new = resolve_smoke_target(base_ref, head_sha, args.evidence_id)

    print(f"Head SHA: {head_sha}")
    print(f"Base ref: {base_ref}")
    print(f"Projection: {projection_id}")
    print(f"Evidence records: {expected_count}")
    print(f"Signal smoke target: {evidence_id} (new={str(evidence_is_new).lower()})")

    if args.preview_url:
        preview_url = args.preview_url.rstrip("/")
        print(f"Using supplied preview: {preview_url}")
    else:
        account_id = require_env("CLOUDFLARE_ACCOUNT_ID")
        api_token = require_env("CLOUDFLARE_API_TOKEN")
        preview_url = wait_for_preview(account_id, api_token, args.project, head_sha, args.timeout)

    run_smoke(
        preview_url=preview_url,
        projection_id=projection_id,
        evidence_id=evidence_id,
        expected_count=expected_count,
        evidence_is_new=evidence_is_new,
        timeout_seconds=args.timeout,
    )

    print(f"Preview smoke passed: projection={projection_id} preview={preview_url}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AssertionError as error:
        print(f"Preview smoke failed: {error}", file=sys.stderr)
        raise SystemExit(1) from error
