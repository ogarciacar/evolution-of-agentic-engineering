#!/usr/bin/env python3
"""Run deployed preview smoke tests from CI or a local checkout."""
from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path

try:
    from .preview_smoke import SmokeReporter, run_smoke, wait_for_preview
    from .publication_build import assert_publication_build
except ImportError:  # Support direct execution: python pipeline/preview/run_preview_smoke.py
    from preview_smoke import SmokeReporter, run_smoke, wait_for_preview
    from publication_build import assert_publication_build

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


def run_from_context(
    *,
    head_sha: str | None = None,
    base_ref: str | None = None,
    preview_url: str | None = None,
    project: str | None = None,
    evidence_id: str | None = None,
    timeout: int = 600,
) -> tuple[str, str]:
    """Resolve repository/deployment context and execute the deployed smoke assertions."""
    reporter = SmokeReporter()
    reporter.banner()

    try:
        if not Path("evidence").is_dir():
            raise SystemExit("Run preview smoke from the repository root")

        resolved_head = resolve_head_sha(head_sha)
        resolved_base = resolve_base_ref(base_ref)
        projection_id = resolved_head[:12]
        expected_count = len(list(Path("evidence").glob("*.yaml")))
        target_evidence_id, evidence_is_new = resolve_smoke_target(resolved_base, resolved_head, evidence_id)

        reporter.section("Context")
        reporter.context_item("Head", resolved_head)
        reporter.context_item("Base", resolved_base)
        reporter.context_item("Projection", projection_id)
        reporter.context_item("Evidence", str(expected_count))
        reporter.context_item("Signal", target_evidence_id)
        reporter.context_item("New evidence", str(evidence_is_new).lower())

        if preview_url:
            resolved_preview_url = preview_url.rstrip("/")
            reporter.context_item("Preview", resolved_preview_url)
        else:
            reporter.section("Readiness")
            account_id = require_env("CLOUDFLARE_ACCOUNT_ID")
            api_token = require_env("CLOUDFLARE_API_TOKEN")
            resolved_preview_url = wait_for_preview(
                account_id,
                api_token,
                project or os.environ.get("CLOUDFLARE_PAGES_PROJECT", DEFAULT_PROJECT),
                resolved_head,
                timeout,
                reporter,
            )
            reporter.context.append(("Preview", resolved_preview_url))

        reporter.section("Publication build")
        assert_publication_build(resolved_preview_url, resolved_head, reporter)

        run_smoke(
            preview_url=resolved_preview_url,
            projection_id=projection_id,
            evidence_id=target_evidence_id,
            expected_count=expected_count,
            evidence_is_new=evidence_is_new,
            timeout_seconds=timeout,
            reporter=reporter,
        )
        reporter.finish(passed=True)
        return resolved_preview_url, projection_id
    except (AssertionError, SystemExit) as error:
        reporter.finish(passed=False, error=str(error))
        raise


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
    run_from_context(
        head_sha=args.head_sha,
        base_ref=args.base_ref,
        preview_url=args.preview_url,
        project=args.project,
        evidence_id=args.evidence_id,
        timeout=args.timeout,
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AssertionError as error:
        print(f"Preview smoke failed: {error}", file=sys.stderr)
        raise SystemExit(1) from error
