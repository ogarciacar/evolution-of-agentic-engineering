from __future__ import annotations

import unittest
from unittest import mock

from pipeline.browser import run_preview_e2e


class PreviewE2ERunnerTest(unittest.TestCase):
    @mock.patch.object(run_preview_e2e, "subprocess")
    @mock.patch.object(run_preview_e2e, "resolve_context")
    @mock.patch.object(run_preview_e2e, "require_local_playwright")
    def test_runner_resolves_context_and_launches_playwright(
        self,
        require_playwright,
        resolve_context,
        subprocess_module,
    ) -> None:
        resolve_context.return_value = {
            "PREVIEW_URL": "https://preview.example.pages.dev",
            "PROJECTION_ID": "deadbeefcafe",
            "EVIDENCE_ID": "2026-09-06-example",
            "EVIDENCE_IS_NEW": "false",
            "EXPECTED_EVIDENCE_COUNT": "20",
        }
        subprocess_module.run.return_value.returncode = 0

        result = run_preview_e2e.run_browser_e2e(
            head_sha="deadbeefcafe0000000000000000000000000000",
            base_ref="origin/main",
            preview_url="https://preview.example.pages.dev",
        )

        self.assertEqual(result, 0)
        require_playwright.assert_called_once_with()
        resolve_context.assert_called_once_with(
            head_sha="deadbeefcafe0000000000000000000000000000",
            base_ref="origin/main",
            preview_url="https://preview.example.pages.dev",
            project=None,
            evidence_id=None,
            timeout=600,
        )

        command, = subprocess_module.run.call_args.args
        self.assertEqual(
            command,
            ["npx", "playwright", "test", "--config", "pipeline/browser/playwright.config.mjs"],
        )
        env = subprocess_module.run.call_args.kwargs["env"]
        self.assertEqual(env["PROJECTION_ID"], "deadbeefcafe")
        self.assertEqual(env["EXPECTED_EVIDENCE_COUNT"], "20")

    @mock.patch.object(run_preview_e2e, "subprocess")
    @mock.patch.object(run_preview_e2e, "resolve_context")
    @mock.patch.object(run_preview_e2e, "require_local_playwright")
    def test_headed_mode_is_forwarded_to_playwright(
        self,
        require_playwright,
        resolve_context,
        subprocess_module,
    ) -> None:
        resolve_context.return_value = {
            "PREVIEW_URL": "https://preview.example.pages.dev",
            "PROJECTION_ID": "deadbeefcafe",
            "EVIDENCE_ID": "2026-09-06-example",
            "EVIDENCE_IS_NEW": "false",
            "EXPECTED_EVIDENCE_COUNT": "20",
        }
        subprocess_module.run.return_value.returncode = 0

        run_preview_e2e.run_browser_e2e(
            preview_url="https://preview.example.pages.dev",
            headed=True,
        )

        command, = subprocess_module.run.call_args.args
        self.assertEqual(command[-1], "--headed")
        require_playwright.assert_called_once_with()

    @mock.patch.object(run_preview_e2e, "install_playwright")
    @mock.patch.object(run_preview_e2e, "subprocess")
    @mock.patch.object(run_preview_e2e, "resolve_context")
    def test_install_mode_bootstraps_playwright(
        self,
        resolve_context,
        subprocess_module,
        install_playwright,
    ) -> None:
        resolve_context.return_value = {
            "PREVIEW_URL": "https://preview.example.pages.dev",
            "PROJECTION_ID": "deadbeefcafe",
            "EVIDENCE_ID": "2026-09-06-example",
            "EVIDENCE_IS_NEW": "false",
            "EXPECTED_EVIDENCE_COUNT": "20",
        }
        subprocess_module.run.return_value.returncode = 0

        run_preview_e2e.run_browser_e2e(
            preview_url="https://preview.example.pages.dev",
            install=True,
        )

        install_playwright.assert_called_once_with()


if __name__ == "__main__":
    unittest.main()
