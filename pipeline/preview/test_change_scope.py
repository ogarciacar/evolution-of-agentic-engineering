from __future__ import annotations

import unittest

from pipeline.preview.change_scope import classify_paths, is_preview_relevant


class PreviewChangeScopeTest(unittest.TestCase):
    def test_publication_and_projection_changes_are_relevant(self) -> None:
        relevant = [
            "evidence/2026-09-12-example.yaml",
            "model/claims.yaml",
            "functions/_middleware.js",
            "evidence-query.css",
            "evidence-search.js",
            "evaluate.html",
            "migrations/0004_example.sql",
            "pipeline/projection/check-evidence-projection.py",
            "pipeline/browser/preview-e2e.spec.mjs",
            "pipeline/preview/run_preview_smoke.py",
            ".github/workflows/preview-e2e.yml",
        ]
        for path in relevant:
            with self.subTest(path=path):
                self.assertTrue(is_preview_relevant(path))

    def test_docs_only_changes_are_not_relevant(self) -> None:
        for path in ["README.md", "CONTRIBUTING.md", "docs/research-notes.md"]:
            with self.subTest(path=path):
                self.assertFalse(is_preview_relevant(path))

    def test_classification_is_deduplicated_and_sorted(self) -> None:
        changed, matched = classify_paths(
            ["README.md", "evidence/b.yaml", "evidence/a.yaml", "evidence/b.yaml"]
        )
        self.assertEqual(changed, ["README.md", "evidence/a.yaml", "evidence/b.yaml"])
        self.assertEqual(matched, ["evidence/a.yaml", "evidence/b.yaml"])


if __name__ == "__main__":
    unittest.main()
