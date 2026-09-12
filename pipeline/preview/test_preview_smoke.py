#!/usr/bin/env python3
"""Unit tests plus an opt-in deployed acceptance test for preview smoke verification."""
from __future__ import annotations

import hashlib
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

try:
    from pipeline.preview import preview_smoke
    from pipeline.preview import publication_build
    from pipeline.preview import run_preview_smoke
except ModuleNotFoundError:  # Support direct execution from the repository root.
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    from pipeline.preview import preview_smoke
    from pipeline.preview import publication_build
    from pipeline.preview import run_preview_smoke


class PreviewSmokeContextTest(unittest.TestCase):
    def test_resolve_head_sha_normalizes_explicit_value(self) -> None:
        sha = "ABCDEF1234567890ABCDEF1234567890ABCDEF12"
        self.assertEqual(run_preview_smoke.resolve_head_sha(sha), sha.lower())

    def test_resolve_head_sha_rejects_invalid_value(self) -> None:
        with self.assertRaises(SystemExit):
            run_preview_smoke.resolve_head_sha("not-a-sha")

    def test_resolve_smoke_target_prefers_new_evidence(self) -> None:
        previous = Path.cwd()
        with tempfile.TemporaryDirectory() as directory:
            os.chdir(directory)
            try:
                evidence = Path("evidence")
                evidence.mkdir()
                (evidence / "existing.yaml").write_text("id: existing\n", encoding="utf-8")
                (evidence / "new.yaml").write_text("id: new\n", encoding="utf-8")
                with patch.object(
                    run_preview_smoke,
                    "added_evidence_paths",
                    return_value=[Path("evidence/new.yaml")],
                ):
                    evidence_id, is_new = run_preview_smoke.resolve_smoke_target("main", "a" * 40, None)
                self.assertEqual(evidence_id, "new")
                self.assertTrue(is_new)
            finally:
                os.chdir(previous)

    def test_resolve_smoke_target_honors_explicit_existing_evidence(self) -> None:
        previous = Path.cwd()
        with tempfile.TemporaryDirectory() as directory:
            os.chdir(directory)
            try:
                evidence = Path("evidence")
                evidence.mkdir()
                (evidence / "existing.yaml").write_text("id: existing\n", encoding="utf-8")
                with patch.object(run_preview_smoke, "added_evidence_paths", return_value=[]):
                    evidence_id, is_new = run_preview_smoke.resolve_smoke_target(
                        "main", "a" * 40, "existing"
                    )
                self.assertEqual(evidence_id, "existing")
                self.assertFalse(is_new)
            finally:
                os.chdir(previous)


class PreviewSmokePrimitiveTest(unittest.TestCase):
    def test_wait_for_preview_selects_successful_deployment_for_exact_commit(self) -> None:
        commit_sha = "a" * 40
        payload = {
            "success": True,
            "result": [
                {
                    "created_on": "2026-09-11T10:00:00Z",
                    "url": "https://wrong.pages.dev",
                    "latest_stage": {"name": "deploy", "status": "success"},
                    "deployment_trigger": {"metadata": {"commit_hash": "b" * 40}},
                },
                {
                    "created_on": "2026-09-11T10:01:00Z",
                    "url": "https://right.pages.dev",
                    "latest_stage": {"name": "deploy", "status": "success"},
                    "deployment_trigger": {"metadata": {"commit_hash": commit_sha}},
                },
            ],
        }
        with patch.object(
            preview_smoke,
            "request",
            return_value=(200, {}, json.dumps(payload).encode("utf-8")),
        ):
            url = preview_smoke.wait_for_preview("account", "token", "project", commit_sha, 1)
        self.assertEqual(url, "https://right.pages.dev")

    def test_wait_for_projection_accepts_expected_projection_and_count(self) -> None:
        projection_id = "abcdef123456"
        body = json.dumps({"projection": projection_id, "count": 20, "evidence": []}).encode("utf-8")
        with patch.object(
            preview_smoke,
            "request",
            return_value=(200, {preview_smoke.PROJECTION_HEADER: projection_id}, body),
        ):
            preview_smoke.wait_for_projection("https://preview.pages.dev", projection_id, 20, 1)

    def test_wait_for_static_routes_accepts_healthy_html(self) -> None:
        with patch.object(
            preview_smoke,
            "request",
            return_value=(200, {"Content-Type": "text/html; charset=utf-8"}, b"<html></html>"),
        ) as request_mock:
            preview_smoke.wait_for_static_routes("https://preview.pages.dev", "abcdef123456", 1)
        self.assertEqual(request_mock.call_count, 3)

    def test_assert_default_main_requires_main_projection(self) -> None:
        body = json.dumps({"projection": "main", "count": 20, "evidence": []}).encode("utf-8")
        with patch.object(
            preview_smoke,
            "request",
            return_value=(200, {preview_smoke.PROJECTION_HEADER: "main"}, body),
        ):
            preview_smoke.assert_default_main("https://preview.pages.dev")

    def test_publication_build_manifest_verifies_commit_outputs_and_public_surfaces(self) -> None:
        commit_sha = "a" * 40
        built_bodies = {
            "research-frontier.json": b'{"claims": []}\n',
            "evaluate.html": b"<html>evaluate</html>\n",
            "synthesis.html": b"<html>synthesis</html>\n",
            "sitemap.xml": b"<urlset></urlset>\n",
        }
        manifest = {
            "version": 1,
            "generator": publication_build.PUBLICATION_GENERATOR,
            "source_commit": commit_sha,
            "artifacts": {
                name: {
                    "sha256": hashlib.sha256(body).hexdigest(),
                    "bytes": len(body),
                }
                for name, body in built_bodies.items()
            },
        }
        # HTML responses may be reserialized or link-rewritten by Pages middleware.
        served_bodies = {
            "evaluate.html": b"<html><a href='/?projection_id=abc'>evaluate</a></html>\n",
            "synthesis.html": b"<!doctype html><html>synthesis</html>\n",
            "sitemap.xml": built_bodies["sitemap.xml"],
        }
        responses = [(200, {}, json.dumps(manifest).encode("utf-8"))]
        for name in publication_build.PUBLISHED_ARTIFACTS:
            headers = {"Content-Type": "text/html; charset=utf-8"} if name.endswith(".html") else {}
            responses.append((200, headers, served_bodies[name]))

        with patch.object(publication_build, "request", side_effect=responses) as request_mock:
            publication_build.assert_publication_build(
                "https://preview.pages.dev",
                commit_sha,
            )

        self.assertEqual(request_mock.call_count, 1 + len(publication_build.PUBLISHED_ARTIFACTS))

    def test_publication_build_manifest_is_required(self) -> None:
        with patch.object(publication_build, "request", return_value=(404, {}, b"")):
            with self.assertRaisesRegex(AssertionError, "Publication build manifest is missing"):
                publication_build.assert_publication_build(
                    "https://preview.pages.dev",
                    "a" * 40,
                )

    def test_publication_build_manifest_must_match_pr_head(self) -> None:
        manifest = {
            "version": 1,
            "generator": publication_build.PUBLICATION_GENERATOR,
            "source_commit": "b" * 40,
            "artifacts": {},
        }
        with patch.object(
            publication_build,
            "request",
            return_value=(200, {}, json.dumps(manifest).encode("utf-8")),
        ):
            with self.assertRaisesRegex(AssertionError, "expected"):
                publication_build.assert_publication_build(
                    "https://preview.pages.dev",
                    "a" * 40,
                )

    def test_run_smoke_composes_all_acceptance_checks(self) -> None:
        reporter = preview_smoke.SmokeReporter()
        with (
            patch.object(preview_smoke, "wait_for_projection") as wait_projection,
            patch.object(preview_smoke, "assert_api_item") as assert_item,
            patch.object(preview_smoke, "assert_signal_page") as assert_signal,
            patch.object(preview_smoke, "wait_for_static_routes") as wait_routes,
            patch.object(preview_smoke, "assert_default_main") as assert_main,
            patch.object(preview_smoke, "assert_new_evidence_isolated") as assert_isolated,
        ):
            preview_smoke.run_smoke(
                preview_url="https://preview.pages.dev",
                projection_id="abcdef123456",
                evidence_id="new-evidence",
                expected_count=21,
                evidence_is_new=True,
                timeout_seconds=30,
                reporter=reporter,
            )
        wait_projection.assert_called_once_with(
            "https://preview.pages.dev", "abcdef123456", 21, 30, reporter
        )
        assert_item.assert_called_once_with(
            "https://preview.pages.dev", "abcdef123456", "new-evidence", reporter
        )
        assert_signal.assert_called_once_with(
            "https://preview.pages.dev", "abcdef123456", "new-evidence", reporter
        )
        wait_routes.assert_called_once_with(
            "https://preview.pages.dev", "abcdef123456", 30, reporter
        )
        assert_main.assert_called_once_with("https://preview.pages.dev", reporter)
        assert_isolated.assert_called_once_with(
            "https://preview.pages.dev", "new-evidence", reporter
        )


class PreviewSmokeReporterTest(unittest.TestCase):
    def test_reporter_writes_github_job_summary(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            summary_path = Path(directory) / "summary.md"
            with patch.dict(os.environ, {"GITHUB_STEP_SUMMARY": str(summary_path)}):
                reporter = preview_smoke.SmokeReporter()
                reporter.context_item("Projection", "abcdef123456")
                reporter.context_item("Evidence", "20")
                reporter.passed("D1 projection", "20/20 evidence records")
                reporter.passed("Route /", "healthy HTML")
                reporter.finish(passed=True)

            summary = summary_path.read_text(encoding="utf-8")
            self.assertIn("## ✅ Preview smoke", summary)
            self.assertIn("`abcdef123456`", summary)
            self.assertIn("**D1 projection** — 20/20 evidence records", summary)
            self.assertIn("**Passed — 2 checks.**", summary)

    def test_reporter_collapses_duplicate_wait_states(self) -> None:
        reporter = preview_smoke.SmokeReporter()
        with patch("builtins.print") as print_mock:
            reporter.waiting("D1 projection", "0/20 evidence records")
            reporter.waiting("D1 projection", "0/20 evidence records")
        self.assertEqual(print_mock.call_count, 1)


@unittest.skipUnless(
    os.environ.get("RUN_DEPLOYED_PREVIEW_SMOKE") == "1",
    "set RUN_DEPLOYED_PREVIEW_SMOKE=1 to exercise the real Cloudflare preview",
)
class DeployedPreviewSmokeTest(unittest.TestCase):
    def test_deployed_preview_smoke(self) -> None:
        """Run the same real deployed acceptance check used by the CLI and CI."""
        run_preview_smoke.run_from_context(
            head_sha=os.environ.get("PR_HEAD_SHA") or None,
            base_ref=os.environ.get("PR_BASE_SHA") or None,
            preview_url=os.environ.get("PREVIEW_URL") or None,
            project=os.environ.get("CLOUDFLARE_PAGES_PROJECT") or None,
            evidence_id=os.environ.get("EVIDENCE_ID") or None,
            timeout=int(os.environ.get("PREVIEW_SMOKE_TIMEOUT_SECONDS", "600")),
        )


if __name__ == "__main__":
    unittest.main()
