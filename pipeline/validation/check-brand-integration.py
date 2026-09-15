#!/usr/bin/env python3
"""Check that branding is owned by page sources/templates rather than middleware."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

BRANDED_SURFACES = [
    "about.html",
    "apply.html",
    "evidence.html",
    "model.html",
    "practices.html",
    "signals.html",
    "contribute.html",
    "functions/signals/[[id]].js",
    "pipeline/templates/evaluate.html",
    "pipeline/build/build-research-synthesis.py",
]

REQUIRED = (
    '/assets/logo.svg',
    '/favicon.ico',
    '/assets/favicon.svg',
    '/assets/brand.css',
)


def main() -> None:
    errors: list[str] = []

    for relative in BRANDED_SURFACES:
        path = ROOT / relative
        text = path.read_text(encoding="utf-8")
        for required in REQUIRED:
            if required not in text:
                errors.append(f"{relative}: missing {required}")

    index = (ROOT / "index.html").read_text(encoding="utf-8")
    for required in ('/assets/logo.svg', '/favicon.ico', '/assets/favicon.svg'):
        if required not in index:
            errors.append(f"index.html: missing {required}")

    middleware = (ROOT / "functions/_middleware.js").read_text(encoding="utf-8")
    for forbidden in ("BRAND_LOGO_CSS", "BRAND_LOGO_HTML", "injectBrandLogo"):
        if forbidden in middleware:
            errors.append(f"functions/_middleware.js: branding concern remains ({forbidden})")

    if errors:
        raise SystemExit("Brand integration check failed:\n- " + "\n- ".join(errors))

    print(f"Brand integration OK across {len(BRANDED_SURFACES) + 1} branded surfaces")


if __name__ == "__main__":
    main()
