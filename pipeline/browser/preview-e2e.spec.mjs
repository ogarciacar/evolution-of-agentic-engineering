import fs from "node:fs";
import { test, expect } from "@playwright/test";

const previewUrl = process.env.PREVIEW_URL;
const projectionId = process.env.PROJECTION_ID;
const evidenceId = process.env.EVIDENCE_ID;
const evidenceIsNew = process.env.EVIDENCE_IS_NEW === "true";
const expectedCount = Number.parseInt(process.env.EXPECTED_EVIDENCE_COUNT || "0", 10);

for (const [name, value] of Object.entries({ PREVIEW_URL: previewUrl, PROJECTION_ID: projectionId, EVIDENCE_ID: evidenceId })) {
  if (!value) throw new Error(`Missing required browser E2E environment variable: ${name}`);
}
if (!Number.isInteger(expectedCount) || expectedCount < 1) throw new Error("EXPECTED_EVIDENCE_COUNT must be a positive integer");

function contextLine(label, value) {
  console.log(`  ${label.padEnd(18)} ${value}`);
}

function pass(checks, label, detail = "") {
  checks.push([label, detail]);
  console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ""}`);
}

function writeSummary(checks, passed, error) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;

  const lines = [
    `## ${passed ? "✅" : "❌"} Preview browser E2E`,
    "",
    "### Context",
    "",
    "| | |",
    "|---|---|",
    `| **Preview** | \`${previewUrl}\` |`,
    `| **Projection** | \`${projectionId}\` |`,
    `| **Evidence** | \`${evidenceId}\` |`,
    `| **New evidence** | \`${String(evidenceIsNew)}\` |`,
    `| **Expected corpus** | \`${expectedCount}\` |`,
    "",
    "### Browser acceptance",
    "",
  ];

  if (checks.length) {
    for (const [label, detail] of checks) lines.push(`- ✅ **${label}**${detail ? ` — ${detail}` : ""}`);
  } else {
    lines.push("- No browser checks completed.");
  }

  lines.push("", "### Result", "");
  lines.push(passed ? `**Passed — ${checks.length} checks.**` : `**Failed:** ${String(error?.message || error || "unknown error")}`);
  fs.appendFileSync(summaryPath, `${lines.join("\n")}\n`, "utf8");
}

function assertProjectedUrl(page) {
  const current = new URL(page.url());
  expect(current.searchParams.get("projection_id"), `projection missing from ${current.pathname}`).toBe(projectionId);
}

function installDiagnostics(page) {
  const origin = new URL(previewUrl).origin;
  const diagnostics = { errors: [], ignoredThirdPartyConsole: 0 };
  const relevantTypes = new Set(["document", "script", "fetch", "xhr"]);

  function isExternal(urlValue) {
    if (!urlValue) return false;
    try { return new URL(urlValue, previewUrl).origin !== origin; } catch { return false; }
  }

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    const sourceUrl = message.location().url;
    const cloudflareRum = text.includes("cloudflareinsights.com/cdn-cgi/rum");
    if (isExternal(sourceUrl) || cloudflareRum) {
      diagnostics.ignoredThirdPartyConsole += 1;
      return;
    }
    diagnostics.errors.push(`console: ${text}`);
  });
  page.on("pageerror", (error) => diagnostics.errors.push(`pageerror: ${error.message}`));
  page.on("response", (response) => {
    const request = response.request();
    let url;
    try { url = new URL(response.url()); } catch { return; }
    if (url.origin !== origin || !relevantTypes.has(request.resourceType())) return;
    if (response.status() >= 400) diagnostics.errors.push(`${request.resourceType()} HTTP ${response.status()}: ${url.pathname}${url.search}`);
  });
  page.on("requestfailed", (request) => {
    let url;
    try { url = new URL(request.url()); } catch { return; }
    if (url.origin !== origin || !relevantTypes.has(request.resourceType())) return;
    diagnostics.errors.push(`${request.resourceType()} failed: ${url.pathname}${url.search} — ${request.failure()?.errorText || "unknown"}`);
  });

  return diagnostics;
}

test("projected reader journey preserves context and renders from D1", async ({ page }, testInfo) => {
  const checks = [];
  const diagnostics = installDiagnostics(page);
  let failure = null;

  console.log("\nPREVIEW BROWSER E2E");
  console.log("===================");
  console.log("\nCONTEXT");
  contextLine("Preview", previewUrl);
  contextLine("Projection", projectionId);
  contextLine("Evidence", evidenceId);
  contextLine("New evidence", String(evidenceIsNew));
  contextLine("Expected corpus", String(expectedCount));

  try {
    console.log("\nACCEPTANCE");

    const homeResponse = await page.goto(`${previewUrl}/?projection_id=${projectionId}`, { waitUntil: "domcontentloaded" });
    expect(homeResponse).not.toBeNull();
    expect(homeResponse.status()).toBe(200);
    expect(homeResponse.headers()["x-evidence-projection"]).toBe(projectionId);
    expect(homeResponse.headers()["x-evidence-landscape-source"]).toBe("d1");
    assertProjectedUrl(page);
    await expect(page.getByRole("heading", { name: "Evolution of Agentic Engineering" })).toBeVisible();
    await expect(page.locator(".landscape-row, .landscape-mobile-row").first()).toBeVisible();
    pass(checks, "Projected home", "D1 landscape selected by URL query");

    const evidenceApiPromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.origin === new URL(previewUrl).origin && url.pathname === "/api/evidence" && response.request().resourceType() === "fetch";
    });
    await page.getByRole("link", { name: /Explore evidence/ }).click();
    const evidenceApiResponse = await evidenceApiPromise;
    assertProjectedUrl(page);
    expect(evidenceApiResponse.status()).toBe(200);
    expect(evidenceApiResponse.headers()["x-evidence-projection"]).toBe(projectionId);
    const evidencePayload = await evidenceApiResponse.json();
    expect(evidencePayload.projection).toBe(projectionId);
    expect(evidencePayload.count).toBe(expectedCount);
    await expect(page.locator("#query-count")).toHaveText(`${expectedCount} ${expectedCount === 1 ? "signal" : "signals"}`);
    pass(checks, "Evidence browser", `${expectedCount} projected signals loaded through /api/evidence`);

    const targetSignal = page.locator(`a.source[href*="/signals/${evidenceId}/"]`).first();
    await expect(targetSignal).toBeVisible();
    const targetHref = await targetSignal.getAttribute("href");
    expect(new URL(targetHref, previewUrl).searchParams.get("projection_id")).toBe(projectionId);
    pass(checks, "Signal link", `${evidenceId} carries projection selector`);

    const signalDocumentPromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname === `/signals/${evidenceId}/` && response.request().resourceType() === "document";
    });
    await targetSignal.click();
    const signalResponse = await signalDocumentPromise;
    assertProjectedUrl(page);
    expect(signalResponse.status()).toBe(200);
    expect(signalResponse.headers()["x-evidence-projection"]).toBe(projectionId);
    expect(signalResponse.headers()["x-evidence-render-source"]).toBe("d1");
    await expect(page.getByText("OBSERVED", { exact: true })).toBeVisible();
    await expect(page.getByText("INTERPRETATION", { exact: true })).toBeVisible();
    await expect(page.getByText("MODEL IMPLICATION", { exact: true })).toBeVisible();
    const sourceHref = await page.getByRole("link", { name: /View source/ }).getAttribute("href");
    expect(sourceHref).not.toContain("projection_id=");
    pass(checks, "Scale Signal", "projected record rendered from D1 with evidence layers");

    const evidenceApiBackPromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname === "/api/evidence" && response.request().resourceType() === "fetch";
    });
    await page.getByRole("link", { name: /Explore the living evidence record/ }).click();
    const evidenceApiBack = await evidenceApiBackPromise;
    assertProjectedUrl(page);
    expect(evidenceApiBack.headers()["x-evidence-projection"]).toBe(projectionId);
    pass(checks, "Signal → Evidence", "projection survives return navigation");

    await page.getByRole("link", { name: /Evaluation/ }).click();
    assertProjectedUrl(page);
    await expect(page.getByRole("heading", { name: "How well do the claims survive the evidence?" })).toBeVisible();
    await expect(page.locator(".claim")).toHaveCount(4);
    const mappedSignalHref = await page.locator(".claim .evidence a").first().getAttribute("href");
    expect(new URL(mappedSignalHref, previewUrl).searchParams.get("projection_id")).toBe(projectionId);
    pass(checks, "Evaluate model", "reader reaches evaluation without losing projection");

    const defaultHomeResponse = await page.goto(`${previewUrl}/`, { waitUntil: "domcontentloaded" });
    expect(defaultHomeResponse).not.toBeNull();
    expect(defaultHomeResponse.status()).toBe(200);
    expect(defaultHomeResponse.headers()["x-evidence-projection"]).toBe("main");
    expect(new URL(page.url()).searchParams.has("projection_id")).toBe(false);
    if (evidenceIsNew) {
      await expect(page.locator(`a[href*="/signals/${evidenceId}/"]`)).toHaveCount(0);
      pass(checks, "Default isolation", `${evidenceId} absent from main homepage`);
    } else {
      pass(checks, "Default isolation", "unselected browser traffic resolves to main");
    }

    expect(diagnostics.errors, `first-party browser/runtime errors:\n${diagnostics.errors.join("\n")}`).toEqual([]);
    const ignoredDetail = diagnostics.ignoredThirdPartyConsole
      ? `; ignored ${diagnostics.ignoredThirdPartyConsole} third-party telemetry console messages`
      : "";
    pass(checks, "Browser health", `no first-party console, page, request, or HTTP errors${ignoredDetail}`);

    console.log("\nRESULT");
    console.log(`  ✓ PASSED — ${checks.length} checks`);
  } catch (error) {
    failure = error;
    console.log("\nRESULT");
    console.log(`  ✗ FAILED — ${error.message}`);
    throw error;
  } finally {
    if (diagnostics.errors.length) {
      await testInfo.attach("browser-errors", {
        body: Buffer.from(diagnostics.errors.join("\n"), "utf8"),
        contentType: "text/plain",
      });
    }
    writeSummary(checks, failure === null, failure);
  }
});
