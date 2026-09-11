#!/usr/bin/env python3
"""Resolve a deployed preview and run the Playwright browser acceptance journey."""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from pipeline.browser.resolve_preview_context import resolve_context
from pipeline.preview.run_preview_smoke import DEFAULT_PROJECT

PLAYWRIGHT_VERSION = "1.62.1"
PLAYWRIGHT_CONFIG = "pipeline/browser/playwright.config.mjs"


def require_command(name: str) -> None:
    if shutil.which(name) is None:
        raise SystemExit(f"Required command is not available: {name}")


def require_local_playwright() -> None:
    require_command("npx")
    if not Path("node_modules/@playwright/test").is_dir():
        raise SystemExit(
            "Playwright is not installed. Run "
            f"`npm install --no-save --package-lock=false @playwright/test@{PLAYWRIGHT_VERSION}` "
            "and `npx playwright install chromium`, or rerun with --install."
        )


def install_playwright() -> None:
    require_command("npm")
    require_command("npx")
    print("\nPLAYWRIGHT SETUP")
    print("================")
    subprocess.run(
        [
            "npm",
            "install",
            "--no-save",
            "--package-lock=false",
            f"@playwright/test@{PLAYWRIGHT_VERSION}",
        ],
        check=True,
    )
    subprocess.run(["npx", "playwright", "install", "chromium"], check=True)


def run_browser_e2e(
    *,
    head_sha: str | None = None,
    base_ref: str | None = None,
    preview_url: str | None = None,
    project: str | None = None,
    evidence_id: str | None = None,
    timeout: int = 600,
    install: bool = False,
    headed: bool = False,
) -> int:
    """Resolve preview context and execute the same Playwright journey used in CI."""
    if not Path("evidence").is_dir():
        raise SystemExit("Run browser E2E from the repository root")

    if install:
        install_playwright()
    else:
        require_local_playwright()

    context = resolve_context(
        head_sha=head_sha,
        base_ref=base_ref,
        preview_url=preview_url,
        project=project,
        evidence_id=evidence_id,
        timeout=timeout,
    )

    env = os.environ.copy()
    env.update(context)

    command = ["npx", "playwright", "test", "--config", PLAYWRIGHT_CONFIG]
    if headed:
        command.append("--headed")

    print("\nBROWSER E2E RUN")
    print("===============")
    print(f"  Command            {' '.join(command)}")
    print(f"  Preview            {context['PREVIEW_URL']}")
    print(f"  Projection         {context['PROJECTION_ID']}")
    print(f"  Evidence           {context['EVIDENCE_ID']}")

    return subprocess.run(command, env=env).returncode


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description="Run the deployed preview browser acceptance journey locally.")
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
    result.add_argument(
        "--install",
        action="store_true",
        help="Install pinned Playwright and Chromium before running. Useful for first-time local setup.",
    )
    result.add_argument("--headed", action="store_true", help="Run Chromium visibly instead of headless.")
    return result


def main() -> int:
    args = parser().parse_args()
    return run_browser_e2e(
        head_sha=args.head_sha,
        base_ref=args.base_ref,
        preview_url=args.preview_url,
        project=args.project,
        evidence_id=args.evidence_id,
        timeout=args.timeout,
        install=args.install,
        headed=args.headed,
    )


if __name__ == "__main__":
    raise SystemExit(main())
