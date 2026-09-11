#!/usr/bin/env python3
"""Reusable Cloudflare Pages preview smoke-test primitives."""
from __future__ import annotations

import json
import os
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urljoin
from urllib.request import Request, urlopen

PROJECTION_HEADER = "X-Evidence-Projection"
USER_AGENT = "eae-preview-smoke/1"


class SmokeReporter:
    """Render one smoke result consistently to the console and GitHub Job Summary."""

    def __init__(self) -> None:
        self.checks: list[tuple[str, str]] = []
        self.context: list[tuple[str, str]] = []
        self._last_wait: dict[str, str] = {}
        self._section: str | None = None

    def banner(self) -> None:
        print("\nPREVIEW SMOKE")
        print("=============")

    def section(self, title: str) -> None:
        if self._section == title:
            return
        self._section = title
        print(f"\n{title.upper()}")

    def context_item(self, label: str, value: str) -> None:
        self.context.append((label, value))
        print(f"  {label:<18} {value}")

    def waiting(self, label: str, detail: str) -> None:
        if self._last_wait.get(label) == detail:
            return
        self._last_wait[label] = detail
        print(f"  … {label:<26} {detail}")

    def passed(self, label: str, detail: str = "") -> None:
        self._last_wait.pop(label, None)
        self.checks.append((label, detail))
        suffix = f" — {detail}" if detail else ""
        print(f"  ✓ {label}{suffix}")

    def finish(self, *, passed: bool, error: str | None = None) -> None:
        self.section("Result")
        if passed:
            print(f"  ✓ PASSED — {len(self.checks)} checks")
        else:
            print(f"  ✗ FAILED — {error or 'unknown error'}")
        self._write_job_summary(passed=passed, error=error)

    def _write_job_summary(self, *, passed: bool, error: str | None) -> None:
        summary_path = os.environ.get("GITHUB_STEP_SUMMARY", "").strip()
        if not summary_path:
            return

        icon = "✅" if passed else "❌"
        lines = [f"## {icon} Preview smoke", "", "### Context", "", "| | |", "|---|---|"]
        lines.extend(f"| **{label}** | `{value}` |" for label, value in self.context)
        lines.extend(["", "### Acceptance", ""])
        if self.checks:
            for label, detail in self.checks:
                suffix = f" — {detail}" if detail else ""
                lines.append(f"- ✅ **{label}**{suffix}")
        else:
            lines.append("- No acceptance checks completed.")

        lines.extend(["", "### Result", ""])
        if passed:
            lines.append(f"**Passed — {len(self.checks)} checks.**")
        else:
            lines.append(f"**Failed:** {error or 'unknown error'}")

        with open(summary_path, "a", encoding="utf-8") as summary:
            summary.write("\n".join(lines) + "\n")


def request(url: str, headers: dict[str, str] | None = None, timeout: int = 20) -> tuple[int, object, bytes]:
    request_headers = {"User-Agent": USER_AGENT, "Cache-Control": "no-cache"}
    if headers:
        request_headers.update(headers)
    req = Request(url, headers=request_headers, method="GET")
    try:
        with urlopen(req, timeout=timeout) as response:
            return response.status, response.headers, response.read()
    except HTTPError as error:
        return error.code, error.headers, error.read()


def parse_json(body: bytes, label: str) -> object:
    try:
        return json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise AssertionError(f"{label} did not return valid JSON: {error}") from error


def wait_for_preview(
    account_id: str,
    api_token: str,
    project_name: str,
    commit_sha: str,
    timeout_seconds: int,
    reporter: SmokeReporter | None = None,
) -> str:
    reporter = reporter or SmokeReporter()
    endpoint = (
        f"https://api.cloudflare.com/client/v4/accounts/{quote(account_id, safe='')}/pages/projects/"
        f"{quote(project_name, safe='')}/deployments?{urlencode({'env': 'preview', 'per_page': 25})}"
    )
    deadline = time.monotonic() + timeout_seconds
    last_state = "not found"

    while time.monotonic() < deadline:
        status, _, body = request(endpoint, {"Authorization": f"Bearer {api_token}"})
        if status in (401, 403):
            raise SystemExit(
                "Cloudflare Pages deployment lookup is unauthorized. "
                "CLOUDFLARE_API_TOKEN needs Pages Read (or Pages Write) permission."
            )
        if status != 200:
            last_state = f"Cloudflare API HTTP {status}"
            reporter.waiting("Pages deployment", last_state)
            time.sleep(10)
            continue

        payload = parse_json(body, "Cloudflare deployments API")
        if not isinstance(payload, dict) or not payload.get("success"):
            raise SystemExit(f"Cloudflare deployments API failed: {payload}")

        matches = []
        for deployment in payload.get("result", []):
            metadata = (deployment.get("deployment_trigger") or {}).get("metadata") or {}
            if metadata.get("commit_hash") == commit_sha:
                matches.append(deployment)

        if not matches:
            last_state = "commit not visible yet"
            reporter.waiting("Pages deployment", last_state)
            time.sleep(10)
            continue

        deployment = max(matches, key=lambda item: item.get("created_on", ""))
        stage = deployment.get("latest_stage") or {}
        stage_status = stage.get("status", "unknown")
        last_state = f"{stage.get('name', 'unknown')} {stage_status}"

        if stage_status in {"failure", "canceled"}:
            raise SystemExit(f"Cloudflare preview deployment failed for {commit_sha}: {last_state}")
        if deployment.get("is_skipped"):
            raise SystemExit(f"Cloudflare preview deployment was skipped for {commit_sha}")
        if stage_status == "success" and deployment.get("url"):
            preview_url = str(deployment["url"]).rstrip("/")
            reporter.passed("Pages deployment", preview_url)
            return preview_url

        reporter.waiting("Pages deployment", last_state)
        time.sleep(10)

    raise SystemExit(f"Timed out waiting for Cloudflare preview deployment: {last_state}")


def api_url(preview_url: str, path: str) -> str:
    separator = "&" if "?" in path else "?"
    cache_buster = f"__smoke={int(time.time() * 1000)}"
    return f"{urljoin(preview_url + '/', path.lstrip('/'))}{separator}{cache_buster}"


def wait_for_projection(
    preview_url: str,
    projection_id: str,
    expected_count: int,
    timeout_seconds: int,
    reporter: SmokeReporter | None = None,
) -> None:
    reporter = reporter or SmokeReporter()
    deadline = time.monotonic() + timeout_seconds
    last_state = "not checked"

    while time.monotonic() < deadline:
        url = api_url(preview_url, "/api/evidence")
        try:
            status, headers, body = request(url, {PROJECTION_HEADER: projection_id})
        except URLError as error:
            last_state = f"network error: {error}"
            reporter.waiting("D1 projection", last_state)
            time.sleep(10)
            continue

        if status == 200:
            payload = parse_json(body, "preview evidence API")
            response_projection = headers.get(PROJECTION_HEADER)
            count = payload.get("count") if isinstance(payload, dict) else None
            body_projection = payload.get("projection") if isinstance(payload, dict) else None
            if response_projection == projection_id and body_projection == projection_id and count == expected_count:
                reporter.passed("D1 projection", f"{count}/{expected_count} evidence records")
                return
            if response_projection == projection_id and body_projection == projection_id:
                last_state = f"{count}/{expected_count} evidence records"
            else:
                last_state = f"header={response_projection!r} body={body_projection!r} count={count!r}"
        else:
            last_state = f"HTTP {status}"

        reporter.waiting("D1 projection", last_state)
        time.sleep(10)

    raise SystemExit(f"Timed out waiting for preview projection {projection_id}: {last_state}")


def assert_api_item(
    preview_url: str,
    projection_id: str,
    evidence_id: str,
    reporter: SmokeReporter | None = None,
) -> None:
    reporter = reporter or SmokeReporter()
    status, headers, body = request(
        api_url(preview_url, f"/api/evidence/{quote(evidence_id, safe='')}"),
        {PROJECTION_HEADER: projection_id},
    )
    assert status == 200, f"Projected evidence API returned HTTP {status} for {evidence_id}"
    assert headers.get(PROJECTION_HEADER) == projection_id, "Projected evidence API returned the wrong projection header"
    payload = parse_json(body, "projected evidence item API")
    assert isinstance(payload, dict) and payload.get("id") == evidence_id, "Projected evidence API returned the wrong evidence item"
    reporter.passed("Evidence API", evidence_id)


def assert_signal_page(
    preview_url: str,
    projection_id: str,
    evidence_id: str,
    reporter: SmokeReporter | None = None,
) -> None:
    reporter = reporter or SmokeReporter()
    url = urljoin(preview_url + "/", f"signals/{quote(evidence_id, safe='')}/")
    status, headers, body = request(url, {PROJECTION_HEADER: projection_id})
    assert status == 200, f"Signal page returned HTTP {status}: {url}"
    assert headers.get(PROJECTION_HEADER) == projection_id, "Signal page returned the wrong projection header"
    assert headers.get("X-Evidence-Render-Source") == "d1", "Signal page was not rendered from D1"
    html = body.decode("utf-8", errors="replace")
    assert "Evidence record" in html and "Scale Signal" in html, "Signal page is missing expected evidence content"
    reporter.passed("Scale Signal", f"D1 render /signals/{evidence_id}/")


def wait_for_static_routes(
    preview_url: str,
    projection_id: str,
    timeout_seconds: int,
    reporter: SmokeReporter | None = None,
) -> None:
    reporter = reporter or SmokeReporter()
    paths = ("/", "/evidence.html", "/evaluate.html")
    deadline = time.monotonic() + timeout_seconds
    last_state = "not checked"

    while time.monotonic() < deadline:
        failures = []
        for path in paths:
            try:
                status, headers, _ = request(
                    api_url(preview_url, path),
                    {PROJECTION_HEADER: projection_id},
                )
            except URLError as error:
                failures.append(f"{path}=network error: {error}")
                continue

            content_type = headers.get("Content-Type", "")
            if status != 200:
                failures.append(f"{path}=HTTP {status}")
            elif "text/html" not in content_type:
                failures.append(f"{path}=content-type {content_type!r}")

        if not failures:
            for path in paths:
                reporter.passed(f"Route {path}", "healthy HTML")
            return

        last_state = ", ".join(failures)
        reporter.waiting("Publication routes", last_state)
        time.sleep(10)

    raise SystemExit(f"Timed out waiting for preview publication routes: {last_state}")


def assert_default_main(preview_url: str, reporter: SmokeReporter | None = None) -> None:
    reporter = reporter or SmokeReporter()
    status, headers, body = request(api_url(preview_url, "/api/evidence"))
    assert status == 200, f"Default evidence API returned HTTP {status}"
    assert headers.get(PROJECTION_HEADER) == "main", "Default evidence API did not resolve to main"
    payload = parse_json(body, "default evidence API")
    assert isinstance(payload, dict) and payload.get("projection") == "main", "Default evidence API body did not resolve to main"
    assert isinstance(payload.get("count"), int) and payload["count"] > 0, "Default main projection is unexpectedly empty"
    reporter.passed("Default projection", f"main ({payload['count']} evidence records)")


def assert_new_evidence_isolated(
    preview_url: str,
    evidence_id: str,
    reporter: SmokeReporter | None = None,
) -> None:
    reporter = reporter or SmokeReporter()
    status, headers, _ = request(api_url(preview_url, f"/api/evidence/{quote(evidence_id, safe='')}"))
    assert status == 404, f"New evidence {evidence_id} unexpectedly exists in default main (HTTP {status})"
    assert headers.get(PROJECTION_HEADER) == "main", "Default evidence item lookup did not resolve to main"
    reporter.passed("Preview isolation", f"{evidence_id} absent from main")


def run_smoke(
    *,
    preview_url: str,
    projection_id: str,
    evidence_id: str,
    expected_count: int,
    evidence_is_new: bool,
    timeout_seconds: int,
    reporter: SmokeReporter | None = None,
) -> None:
    reporter = reporter or SmokeReporter()
    reporter.section("Readiness")
    wait_for_projection(preview_url, projection_id, expected_count, timeout_seconds, reporter)

    reporter.section("Acceptance")
    assert_api_item(preview_url, projection_id, evidence_id, reporter)
    assert_signal_page(preview_url, projection_id, evidence_id, reporter)
    wait_for_static_routes(preview_url, projection_id, timeout_seconds, reporter)
    assert_default_main(preview_url, reporter)
    if evidence_is_new:
        assert_new_evidence_isolated(preview_url, evidence_id, reporter)
