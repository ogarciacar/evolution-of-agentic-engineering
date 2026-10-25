import assert from "node:assert/strict";
import test from "node:test";
import { dispatchGitHubWorkflow } from "./index.mjs";

test("dispatches only the expected main-branch workflow", async () => {
  let calls = 0;
  await dispatchGitHubWorkflow("test-only-token", async (url, options) => {
    calls += 1;
    assert.equal(
      url,
      "https://api.github.com/repos/ogarciacar/evolution-of-agentic-engineering/actions/workflows/oracle-a1-capacity-watch.yml/dispatches",
    );
    assert.equal(options.method, "POST");
    assert.equal(options.headers.Authorization, "Bearer test-only-token");
    assert.equal(options.headers["X-GitHub-Api-Version"], "2022-11-28");
    assert.deepEqual(JSON.parse(options.body), {
      ref: "main",
      inputs: { dispatch_origin: "cloudflare-cron" },
    });
    return { status: 204 };
  });
  assert.equal(calls, 1);
});

test("refuses to dispatch without a secret", async () => {
  await assert.rejects(
    () => dispatchGitHubWorkflow(undefined, () => {
      throw new Error("Should not fetch");
    }),
    /Missing GITHUB_DISPATCH_TOKEN/,
  );
});

test("surfaces rejected dispatch without including the token", async () => {
  const token = "super-secret-test-token";
  await assert.rejects(
    () => dispatchGitHubWorkflow(token, async () => ({ status: 403 })),
    (error) => {
      assert.match(error.message, /HTTP 403/);
      assert.ok(!error.message.includes(token));
      return true;
    },
  );
});
