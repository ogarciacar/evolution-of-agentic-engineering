#!/usr/bin/env python3
"""Verify that a deployed Pages preview was materialized by the publication build."""
from __future__ import annotations

import hashlib
import re

try:
    from .preview_smoke import SmokeReporter, api_url, parse_json, request
except ImportError:  # Support direct execution from the repository root.
    from preview_smoke import SmokeReporter, api_url, parse_json, request

PUBLICATION_MANIFEST_PATH = "/publication-manifest.json"
PUBLICATION_GENERATOR = "pipeline/build-publication.py"
REQUIRED_ARTIFACTS = (
    "research-frontier.json",
    "evaluate.html",
    "synthesis.html",
    "sitemap.xml",
)
PUBLISHED_ARTIFACTS = (
    "evaluate.html",
    "synthesis.html",
    "sitemap.xml",
)
EXACT_BYTE_ARTIFACTS = {"sitemap.xml"}
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
COMMIT_RE = re.compile(r"^[0-9a-f]{40}$")


def assert_publication_build(
    preview_url: str,
    expected_commit: str,
    reporter: SmokeReporter | None = None,
) -> None:
    """Require build provenance and verify the public publication surfaces."""
    reporter = reporter or SmokeReporter()
    status, _, body = request(api_url(preview_url, PUBLICATION_MANIFEST_PATH))
    assert status == 200, (
        "Publication build manifest is missing. Cloudflare Pages must run "
        "pipeline/build-publication.py before deployment."
    )

    try:
        payload = parse_json(body, "publication build manifest")
    except AssertionError as error:
        raise AssertionError(
            "Publication build manifest was not generated as JSON. Cloudflare Pages must run "
            "pipeline/build-publication.py before deployment."
        ) from error

    assert isinstance(payload, dict), "Publication build manifest must be a JSON object"
    assert payload.get("version") == 1, "Publication build manifest has an unsupported version"
    assert payload.get("generator") == PUBLICATION_GENERATOR, "Publication build manifest has the wrong generator"

    manifest_commit = payload.get("source_commit")
    assert isinstance(manifest_commit, str) and COMMIT_RE.fullmatch(manifest_commit), (
        "Publication build manifest is missing a valid Cloudflare source commit"
    )
    assert manifest_commit == expected_commit, (
        f"Publication build manifest belongs to {manifest_commit}, expected {expected_commit}"
    )

    artifacts = payload.get("artifacts")
    assert isinstance(artifacts, dict), "Publication build manifest is missing artifacts"
    assert set(artifacts) == set(REQUIRED_ARTIFACTS), "Publication build manifest has the wrong artifact set"

    for artifact in REQUIRED_ARTIFACTS:
        metadata = artifacts[artifact]
        assert isinstance(metadata, dict), f"Publication manifest metadata is invalid for {artifact}"
        expected_sha = metadata.get("sha256")
        expected_bytes = metadata.get("bytes")
        assert isinstance(expected_sha, str) and SHA256_RE.fullmatch(expected_sha), (
            f"Publication manifest has an invalid SHA-256 for {artifact}"
        )
        assert isinstance(expected_bytes, int) and expected_bytes >= 0, (
            f"Publication manifest has an invalid byte count for {artifact}"
        )

    for artifact in PUBLISHED_ARTIFACTS:
        metadata = artifacts[artifact]
        artifact_status, artifact_headers, artifact_body = request(api_url(preview_url, f"/{artifact}"))
        assert artifact_status == 200, f"Published artifact returned HTTP {artifact_status}: /{artifact}"

        if artifact in EXACT_BYTE_ARTIFACTS:
            actual_sha = hashlib.sha256(artifact_body).hexdigest()
            assert actual_sha == metadata["sha256"], f"Published artifact hash does not match build manifest: {artifact}"
            assert len(artifact_body) == metadata["bytes"], f"Published artifact size does not match build manifest: {artifact}"
            continue

        content_type = artifact_headers.get("Content-Type", "")
        assert "text/html" in content_type, f"Published HTML artifact has wrong content type: {artifact}"
        html = artifact_body.decode("utf-8", errors="replace").lower()
        assert "<html" in html or "<!doctype html" in html, f"Published HTML artifact is not HTML: {artifact}"

    reporter.passed(
        "Publication build",
        f"commit {expected_commit[:12]} + 4 generated outputs + 3 published surfaces",
    )
