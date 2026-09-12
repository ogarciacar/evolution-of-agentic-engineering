#!/usr/bin/env python3
"""Decide whether a pull request requires deployed preview acceptance."""
from __future__ import annotations

import argparse
import fnmatch
import os
import subprocess
from pathlib import Path
from typing import Iterable

# Keep this intentionally focused on files that can change the published reader
# experience, D1 evidence projection, or the deployed acceptance machinery itself.
PREVIEW_RELEVANT_PATTERNS = (
    "evidence/**",
    "model/**",
    "schema/**",
    "migrations/**",
    "functions/**",
    "*.html",
    "*.css",
    "*.js",
    "_headers",
    "pipeline/build-publication.py",
    "pipeline/build-derived-artifacts.py",
    "pipeline/build/**",
    "pipeline/templates/**",
    "pipeline/projection/**",
    "pipeline/preview/**",
    "pipeline/browser/**",
    "pipeline/validation/validate-evidence.py",
    ".github/workflows/preview-smoke.yml",
    ".github/workflows/preview-e2e.yml",
    ".github/workflows/sync-preview-evidence-d1.yml",
)


def is_preview_relevant(path: str) -> bool:
    normalized = path.strip().replace("\\", "/")
    return bool(normalized) and any(
        fnmatch.fnmatchcase(normalized, pattern) for pattern in PREVIEW_RELEVANT_PATTERNS
    )


def classify_paths(paths: Iterable[str]) -> tuple[list[str], list[str]]:
    changed = sorted({path.strip().replace("\\", "/") for path in paths if path.strip()})
    relevant = [path for path in changed if is_preview_relevant(path)]
    return changed, relevant


def changed_paths_from_git(base: str, head: str) -> list[str]:
    result = subprocess.run(
        ["git", "diff", "--name-only", f"{base}...{head}"],
        check=True,
        capture_output=True,
        text=True,
    )
    return [line for line in result.stdout.splitlines() if line.strip()]


def write_github_outputs(relevant: bool, changed_count: int, matched_count: int) -> None:
    output_path = os.environ.get("GITHUB_OUTPUT", "").strip()
    if not output_path:
        return
    with open(output_path, "a", encoding="utf-8") as output:
        output.write(f"relevant={'true' if relevant else 'false'}\n")
        output.write(f"changed_count={changed_count}\n")
        output.write(f"matched_count={matched_count}\n")


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description="Classify whether a PR needs deployed preview acceptance.")
    result.add_argument("--base", default=os.environ.get("PR_BASE_SHA"), help="Pull-request base SHA/ref.")
    result.add_argument("--head", default=os.environ.get("PR_HEAD_SHA"), help="Pull-request head SHA/ref.")
    result.add_argument("paths", nargs="*", help="Optional changed paths; skips git diff when supplied.")
    return result


def main() -> int:
    args = parser().parse_args()
    if args.paths:
        paths = args.paths
    else:
        if not args.base or not args.head:
            raise SystemExit("Provide --base/--head or PR_BASE_SHA/PR_HEAD_SHA")
        if not Path(".git").exists():
            raise SystemExit("Run preview change-scope detection from the repository root")
        paths = changed_paths_from_git(args.base, args.head)

    changed, matched = classify_paths(paths)
    relevant = bool(matched)

    print("\nPREVIEW CHANGE SCOPE")
    print("====================")
    print(f"  Changed files      {len(changed)}")
    print(f"  Relevant files     {len(matched)}")
    print(f"  Deployed preview   {'required' if relevant else 'not applicable'}")
    if matched:
        print("\nMATCHED")
        for path in matched:
            print(f"  ✓ {path}")

    write_github_outputs(relevant, len(changed), len(matched))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
