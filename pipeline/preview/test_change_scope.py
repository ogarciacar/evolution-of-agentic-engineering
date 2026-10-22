from __future__ import annotations

import unittest

from pipeline.preview.change_scope import classify_paths, is_preview_relevant


class PreviewChangeScopeTest(unittest.TestCase):
    def test_publication_and_projection_changes_are_relevant(self) -> None:
        relevant = [
            "evidence/2026-09-12-example.yaml",
            "model/claims.yaml",
            "functions/_middleware.js",
            "functions/api/search.js",
            "pipeline/templates/nested/page.html",
            "pipeline/build/assets/style.css",
            "evidence-query.css",
            "evidence-search.js",
            "evaluate.html",
            "migrations/0004_example.sql",
            "pipeline/build-publication.py",
            "pipeline/build/build-model-evaluation.py",
            "pipeline/templates/evaluate.html",
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

    def test_asset_patterns_only_match_repository_root(self) -> None:
        for extension in ["js", "css", "html"]:
            with self.subTest(extension=extension):
                self.assertTrue(is_preview_relevant(f"asset.{extension}"))
                self.assertFalse(is_preview_relevant(f"workers/ai-search/asset.{extension}"))
                self.assertFalse(is_preview_relevant(f"tests/fixtures/asset.{extension}"))

    def test_worker_only_changes_do_not_require_pages_preview(self) -> None:
        _, matched = classify_paths([
            "workers/ai-search/answer.js",
            "workers/ai-search/evaluation-case.mjs",
            "tests/investigate/answer.worker.test.mjs",
            "docs/answer-semantic-review.md",
        ])
        self.assertEqual(matched, [])

    def test_mixed_changes_keep_pages_coverage(self) -> None:
        _, matched = classify_paths([
            "workers/ai-search/answer.js",
            "functions/api/search.js",
            "evidence-search.js",
        ])
        self.assertEqual(matched, ["evidence-search.js", "functions/api/search.js"])

    def test_windows_separators_preserve_path_scope(self) -> None:
        self.assertFalse(is_preview_relevant(r"workers\ai-search\answer.js"))
        self.assertTrue(is_preview_relevant(r"functions\api\search.js"))

    def test_classification_is_deduplicated_and_sorted(self) -> None:
        changed, matched = classify_paths(
            ["README.md", "evidence/b.yaml", "evidence/a.yaml", "evidence/b.yaml"]
        )
        self.assertEqual(changed, ["README.md", "evidence/a.yaml", "evidence/b.yaml"])
        self.assertEqual(matched, ["evidence/a.yaml", "evidence/b.yaml"])


if __name__ == "__main__":
    unittest.main()
