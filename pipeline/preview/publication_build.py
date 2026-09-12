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
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")


def assert_publication_build(
    preview_url: str,
    reporter: SmokeReporter | None = None,
) -> None:
    """Require a build-only manifest and verify every published derived artifact."""
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

        artifact_status, _, artifact_body = request(api_url(preview_url, f"/{artifact}"))
        assert artifact_status == 200, f"Published artifact returned HTTP {artifact_status}: /{artifact}"
        actual_sha = hashlib.sha256(artifact_body).hexdigest()
        assert actual_sha == expected_sha, f"Published artifact hash does not match build manifest: {artifact}"
        assert len(artifact_body) == expected_bytes, f"Published artifact size does not match build manifest: {artifact}"

    reporter.passed("Publication build", f"manifest + {len(REQUIRED_ARTIFACTS)} verified artifacts")
