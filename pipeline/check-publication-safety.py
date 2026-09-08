#!/usr/bin/env python3
"""Fail on evidence URLs that are obviously unsafe for public publication.

This is defense in depth, not a confidentiality detector. Passing this check does not
establish that evidence is public; contributors and reviewers must still apply the
public-evidence safety protocol in CONTRIBUTING.md.
"""
from __future__ import annotations

import ipaddress
import sys
from pathlib import Path
from urllib.parse import parse_qsl, urlsplit

import yaml

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE_DIR = ROOT / "evidence"

RESTRICTED_HOST_SUFFIXES = (".internal", ".local", ".localhost", ".corp", ".lan", ".home", ".intranet")
SENSITIVE_QUERY_KEYS = {
    "access_token", "api_key", "apikey", "auth", "authorization", "key", "password",
    "secret", "signature", "sig", "token",
}
RESTRICTED_HOSTS = {"localhost"}


def unsafe_url_reason(url: str) -> str | None:
    try:
        parsed = urlsplit(url)
    except ValueError:
        return "cannot parse source URL"

    if parsed.scheme != "https":
        return "source URL must use https"
    if parsed.username is not None or parsed.password is not None:
        return "source URL contains embedded credentials"

    host = (parsed.hostname or "").rstrip(".").lower()
    if not host:
        return "source URL has no hostname"
    if host in RESTRICTED_HOSTS or host.endswith(RESTRICTED_HOST_SUFFIXES):
        return f"source hostname looks private or local: {host}"

    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        address = None
    if address is not None and not address.is_global:
        return f"source URL uses a non-public IP address: {host}"

    query_keys = {key.lower() for key, _ in parse_qsl(parsed.query, keep_blank_values=True)}
    sensitive = sorted(query_keys & SENSITIVE_QUERY_KEYS)
    if sensitive:
        return f"source URL contains sensitive query parameter(s): {', '.join(sensitive)}"

    return None


def main() -> int:
    failures = 0
    files = sorted(EVIDENCE_DIR.glob("*.yaml"))
    if not files:
        print("No evidence YAML records found", file=sys.stderr)
        return 1

    for path in files:
        try:
            record = yaml.safe_load(path.read_text(encoding="utf-8"))
        except yaml.YAMLError as exc:
            failures += 1
            print(f"{path.relative_to(ROOT)}: invalid YAML: {exc}", file=sys.stderr)
            continue

        source = record.get("source") if isinstance(record, dict) else None
        url = source.get("url") if isinstance(source, dict) else None
        if not isinstance(url, str):
            failures += 1
            print(f"{path.relative_to(ROOT)}: source.url is missing or invalid", file=sys.stderr)
            continue

        reason = unsafe_url_reason(url)
        if reason:
            failures += 1
            print(f"{path.relative_to(ROOT)}: PUBLICATION SAFETY: {reason}", file=sys.stderr)

    if failures:
        print(f"Publication safety lint failed with {failures} error(s)", file=sys.stderr)
        print("Do not bypass this check to publish restricted evidence.", file=sys.stderr)
        return 1

    print(f"Publication safety lint passed for {len(files)} evidence records")
    print("NOTE: this check catches only obvious URL hazards; it cannot prove that content is public.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
