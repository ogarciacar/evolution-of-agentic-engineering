#!/usr/bin/env python3
"""Resolve the exact Cloudflare preview and SHA projection used by browser E2E."""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from pipeline.preview.preview_smoke import SmokeReporter, wait_for_preview, wait_for_projection, wait_for_static_routes
from pipeline.preview.run_preview_smoke import DEFAULT_PROJECT, added_evidence_paths, require_env, resolve_base_ref, resolve_head_sha


def resolve_browser_target(base_ref: str, head_sha: str, explicit_evidence_id: str | None) -> tuple[str, bool]:
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

    # Browser tests should exercise a recent signal because the homepage is intentionally bounded.
    return evidence_files[-1].stem, False


def export_context(values: dict[str, str]) -> None:
    github_env = os.environ.get("GITHUB_ENV", "").strip()
    if github_env:
        with open(github_env, "a", encoding="utf-8") as output:
            for key, value in values.items():
                output.write(f"{key}={value}\n")

    print("\nBROWSER E2E CONTEXT")
    print("===================")
    for key, value in values.items():
        print(f"  {key:<22} {value}")


def resolve_context(
    *,
    head_sha: str | None = None,
    base_ref: str | None = None,
    preview_url: str | None = None,
    project: str | None = None,
    evidence_id: str | None = None,
    timeout: int = 600,
    reporter: SmokeReporter | None = None,
) -> dict[str, str]:
    """Resolve and wait for the deployed browser context, then return its environment values."""
    if not Path("evidence").is_dir():
        raise SystemExit("Run browser E2E from the repository root")

    resolved_head_sha = resolve_head_sha(head_sha)
    resolved_base_ref = resolve_base_ref(base_ref)
    projection_id = resolved_head_sha[:12]
    expected_count = len(list(Path("evidence").glob("*.yaml")))
    resolved_evidence_id, evidence_is_new = resolve_browser_target(
        resolved_base_ref,
        resolved_head_sha,
        evidence_id,
    )

    active_reporter = reporter or SmokeReporter()
    active_reporter.section("Browser readiness")
    if preview_url:
        resolved_preview_url = preview_url.rstrip("/")
        active_reporter.passed("Pages deployment", resolved_preview_url)
    else:
        resolved_preview_url = wait_for_preview(
            require_env("CLOUDFLARE_ACCOUNT_ID"),
            require_env("CLOUDFLARE_API_TOKEN"),
            project or os.environ.get("CLOUDFLARE_PAGES_PROJECT", DEFAULT_PROJECT),
            resolved_head_sha,
            timeout,
            active_reporter,
        )

    wait_for_projection(resolved_preview_url, projection_id, expected_count, timeout, active_reporter)
    wait_for_static_routes(resolved_preview_url, projection_id, timeout, active_reporter)

    return {
        "PREVIEW_URL": resolved_preview_url,
        "PROJECTION_ID": projection_id,
        "EVIDENCE_ID": resolved_evidence_id,
        "EVIDENCE_IS_NEW": str(evidence_is_new).lower(),
        "EXPECTED_EVIDENCE_COUNT": str(expected_count),
    }


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description="Resolve and wait for the deployed preview used by browser E2E.")
    result.add_argument("--head-sha", help="PR head commit. Defaults to PR_HEAD_SHA or local HEAD.")
    result.add_argument("--base-ref", help="Base SHA/ref. Defaults to PR_BASE_SHA or origin/main.")
    result.add_argument("--preview-url", help="Atomic Pages preview URL. Skips Pages API discovery when supplied.")
    result.add_argument("--project", default=os.environ.get("CLOUDFLARE_PAGES_PROJECT", DEFAULT_PROJECT))
    result.add_argument("--evidence-id", help="Evidence record used by the browser journey.")
    result.add_argument(
        "--timeout",
        type=int,
        default=int(os.environ.get("PREVIEW_E2E_TIMEOUT_SECONDS", "600")),
        help="Seconds to wait for preview and projection readiness (default: 600).",
    )
    return result


def main() -> int:
    args = parser().parse_args()
    values = resolve_context(
        head_sha=args.head_sha,
        base_ref=args.base_ref,
        preview_url=args.preview_url,
        project=args.project,
        evidence_id=args.evidence_id,
        timeout=args.timeout,
    )
    export_context(values)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
