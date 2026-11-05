#!/usr/bin/env bash
set -euo pipefail

: "${INFERENCE_URL:?Set INFERENCE_URL to the inference service origin}"
: "${INFERENCE_API_TOKEN:?Set INFERENCE_API_TOKEN (never commit it)}"

origin="${INFERENCE_URL%/}"
auth="Authorization: Bearer ${INFERENCE_API_TOKEN}"
workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

echo "1/4 Unauthenticated requests are denied"
code="$(curl -sS -o "$workdir/unauth" -w '%{http_code}' "$origin/v1/liveness")"
test "$code" = 401 || { echo "Expected 401, got $code"; exit 1; }

echo "2/4 Authenticated liveness succeeds"
curl --fail-with-body -sS -H "$auth" "$origin/v1/liveness" > "$workdir/health"
cat "$workdir/health"; echo

echo "3/4 Admin routes are inaccessible"
code="$(curl -sS -o "$workdir/admin" -w '%{http_code}' -H "$auth" "$origin/admin/")"
test "$code" = 404 || { echo "Expected 404, got $code"; exit 1; }

echo "4/4 List available models"
curl --fail-with-body -sS -H "$auth" "$origin/v1/models" > "$workdir/models"
cat "$workdir/models"; echo

echo "Authentication, liveness and model discovery OK."
echo "Next: send a chat completion using the exact provider-qualified model ID above."
