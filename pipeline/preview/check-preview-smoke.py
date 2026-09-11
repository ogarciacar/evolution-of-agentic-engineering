#!/usr/bin/env python3
"""Smoke-test a Cloudflare Pages PR preview against its SHA-scoped evidence projection."""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urljoin
from urllib.request import Request, urlopen

PROJECTION_HEADER = "X-Evidence-Projection"
USER_AGENT = "eae-preview-smoke/1"


def require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise SystemExit(f"Missing required environment variable: {name}")
    return value


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


def wait_for_preview(account_id: str, api_token: str, project_name: str, commit_sha: str, timeout_seconds: int) -> str:
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
            print(f"Waiting for preview deployment: {last_state}")
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
            last_state = "deployment for PR head not visible yet"
            print(f"Waiting for preview deployment: {last_state}")
            time.sleep(10)
            continue

        deployment = max(matches, key=lambda item: item.get("created_on", ""))
        stage = deployment.get("latest_stage") or {}
        stage_status = stage.get("status", "unknown")
        last_state = f"stage={stage.get('name', 'unknown')} status={stage_status}"

        if stage_status in {"failure", "canceled"}:
            raise SystemExit(f"Cloudflare preview deployment failed for {commit_sha}: {last_state}")
        if deployment.get("is_skipped"):
            raise SystemExit(f"Cloudflare preview deployment was skipped for {commit_sha}")
        if stage_status == "success" and deployment.get("url"):
            preview_url = str(deployment["url"]).rstrip("/")
            print(f"Preview deployment ready: {preview_url}")
            return preview_url

        print(f"Waiting for preview deployment: {last_state}")
        time.sleep(10)

    raise SystemExit(f"Timed out waiting for Cloudflare preview deployment: {last_state}")


def api_url(preview_url: str, path: str) -> str:
    separator = "&" if "?" in path else "?"
    cache_buster = f"__smoke={int(time.time() * 1000)}"
    return f"{urljoin(preview_url + '/', path.lstrip('/'))}{separator}{cache_buster}"


def wait_for_projection(preview_url: str, projection_id: str, expected_count: int, timeout_seconds: int) -> None:
    deadline = time.monotonic() + timeout_seconds
    last_state = "not checked"

    while time.monotonic() < deadline:
        url = api_url(preview_url, "/api/evidence")
        try:
            status, headers, body = request(url, {PROJECTION_HEADER: projection_id})
        except URLError as error:
            last_state = f"network error: {error}"
            print(f"Waiting for preview projection: {last_state}")
            time.sleep(10)
            continue

        if status == 200:
            payload = parse_json(body, "preview evidence API")
            response_projection = headers.get(PROJECTION_HEADER)
            count = payload.get("count") if isinstance(payload, dict) else None
            body_projection = payload.get("projection") if isinstance(payload, dict) else None
            if response_projection == projection_id and body_projection == projection_id and count == expected_count:
                print(f"Preview projection ready: {projection_id} ({count} evidence records)")
                return
            last_state = (
                f"header={response_projection!r} body={body_projection!r} "
                f"count={count!r} expected={expected_count}"
            )
        else:
            last_state = f"HTTP {status}"

        print(f"Waiting for preview projection: {last_state}")
        time.sleep(10)

    raise SystemExit(f"Timed out waiting for preview projection {projection_id}: {last_state}")


def assert_api_item(preview_url: str, projection_id: str, evidence_id: str) -> None:
    status, headers, body = request(
        api_url(preview_url, f"/api/evidence/{quote(evidence_id, safe='')}"),
        {PROJECTION_HEADER: projection_id},
    )
    assert status == 200, f"Projected evidence API returned HTTP {status} for {evidence_id}"
    assert headers.get(PROJECTION_HEADER) == projection_id, "Projected evidence API returned the wrong projection header"
    payload = parse_json(body, "projected evidence item API")
    assert isinstance(payload, dict) and payload.get("id") == evidence_id, "Projected evidence API returned the wrong evidence item"
    print(f"Projected evidence item available: {evidence_id}")


def assert_signal_page(preview_url: str, projection_id: str, evidence_id: str) -> None:
    url = urljoin(preview_url + "/", f"signals/{quote(evidence_id, safe='')}/")
    status, headers, body = request(url, {PROJECTION_HEADER: projection_id})
    assert status == 200, f"Signal page returned HTTP {status}: {url}"
    assert headers.get(PROJECTION_HEADER) == projection_id, "Signal page returned the wrong projection header"
    assert headers.get("X-Evidence-Render-Source") == "d1", "Signal page was not rendered from D1"
    html = body.decode("utf-8", errors="replace")
    assert "Evidence record" in html and "Scale Signal" in html, "Signal page is missing expected evidence content"
    print(f"Signal page rendered from D1: /signals/{evidence_id}/")


def assert_static_routes(preview_url: str, projection_id: str) -> None:
    for path in ("/", "/evidence.html", "/evaluate.html"):
        status, headers, _ = request(urljoin(preview_url + "/", path.lstrip("/")), {PROJECTION_HEADER: projection_id})
        assert status == 200, f"Preview route {path} returned HTTP {status}"
        content_type = headers.get("Content-Type", "")
        assert "text/html" in content_type, f"Preview route {path} did not return HTML: {content_type!r}"
        print(f"Preview route healthy: {path}")


def assert_default_main(preview_url: str) -> None:
    status, headers, body = request(api_url(preview_url, "/api/evidence"))
    assert status == 200, f"Default evidence API returned HTTP {status}"
    assert headers.get(PROJECTION_HEADER) == "main", "Default evidence API did not resolve to main"
    payload = parse_json(body, "default evidence API")
    assert isinstance(payload, dict) and payload.get("projection") == "main", "Default evidence API body did not resolve to main"
    assert isinstance(payload.get("count"), int) and payload["count"] > 0, "Default main projection is unexpectedly empty"
    print(f"Default projection remains canonical main ({payload['count']} evidence records)")


def assert_new_evidence_isolated(preview_url: str, evidence_id: str) -> None:
    status, headers, _ = request(api_url(preview_url, f"/api/evidence/{quote(evidence_id, safe='')}"))
    assert status == 404, f"New evidence {evidence_id} unexpectedly exists in default main (HTTP {status})"
    assert headers.get(PROJECTION_HEADER) == "main", "Default evidence item lookup did not resolve to main"
    print(f"New evidence is isolated from default main: {evidence_id}")


def main() -> int:
    account_id = require_env("CLOUDFLARE_ACCOUNT_ID")
    api_token = require_env("CLOUDFLARE_API_TOKEN")
    project_name = require_env("CLOUDFLARE_PAGES_PROJECT")
    commit_sha = require_env("PR_HEAD_SHA")
    projection_id = require_env("PROJECTION_ID")
    evidence_id = require_env("EVIDENCE_ID")
    expected_count = int(require_env("EXPECTED_EVIDENCE_COUNT"))
    evidence_is_new = os.environ.get("EVIDENCE_IS_NEW", "false").lower() == "true"
    timeout_seconds = int(os.environ.get("PREVIEW_SMOKE_TIMEOUT_SECONDS", "600"))

    if projection_id != commit_sha[:12]:
        raise SystemExit(f"Projection id {projection_id} does not match PR head {commit_sha[:12]}")
    if not Path("evidence").is_dir():
        raise SystemExit("Run preview smoke from the repository root")

    preview_url = wait_for_preview(account_id, api_token, project_name, commit_sha, timeout_seconds)
    wait_for_projection(preview_url, projection_id, expected_count, timeout_seconds)
    assert_api_item(preview_url, projection_id, evidence_id)
    assert_signal_page(preview_url, projection_id, evidence_id)
    assert_static_routes(preview_url, projection_id)
    assert_default_main(preview_url)
    if evidence_is_new:
        assert_new_evidence_isolated(preview_url, evidence_id)

    print(f"Preview smoke passed: projection={projection_id} preview={preview_url}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AssertionError as error:
        print(f"Preview smoke failed: {error}", file=sys.stderr)
        raise SystemExit(1) from error
