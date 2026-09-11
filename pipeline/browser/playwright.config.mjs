import path from "node:path";
import { defineConfig } from "@playwright/test";

const root = process.cwd();

export default defineConfig({
  testDir: path.resolve(root, "pipeline/browser"),
  testMatch: "preview-e2e.spec.mjs",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  outputDir: path.resolve(root, "test-results/browser-e2e"),
  reporter: process.env.CI
    ? [
        ["list"],
        ["github", { omitTags: true }],
        ["html", { outputFolder: path.resolve(root, "playwright-report"), open: "never" }],
      ]
    : [
        ["list"],
        ["html", { outputFolder: path.resolve(root, "playwright-report"), open: "never" }],
      ],
  use: {
    baseURL: process.env.PREVIEW_URL,
    browserName: "chromium",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
});
