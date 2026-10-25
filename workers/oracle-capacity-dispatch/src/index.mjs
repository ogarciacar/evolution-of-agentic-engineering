const WORKFLOW_DISPATCH_URL =
  "https://api.github.com/repos/ogarciacar/evolution-of-agentic-engineering/actions/workflows/oracle-a1-capacity-watch.yml/dispatches";

/**
 * Dispatch only the existing GitHub Actions workflow.
 * Oracle credentials stay in GitHub Actions, never in Cloudflare.
 */
export async function dispatchGitHubWorkflow(token, fetcher = fetch) {
  if (typeof token !== "string" || token.trim().length === 0) {
    throw new Error("Missing GITHUB_DISPATCH_TOKEN Worker secret");
  }

  const response = await fetcher(WORKFLOW_DISPATCH_URL, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "eae-oracle-capacity-dispatch",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      ref: "main",
      inputs: { dispatch_origin: "cloudflare-cron" },
    }),
  });

  // GitHub returns 204 when it accepts a dispatch; this does NOT mean
  // the downstream workflow has run or that Oracle capacity is available.
  if (response.status !== 204) {
    // Never log the token, API response body, or outgoing request headers.
    throw new Error(`GitHub workflow dispatch failed (HTTP ${response.status})`);
  }
}

export default {
  async scheduled(_controller, env) {
    await dispatchGitHubWorkflow(env.GITHUB_DISPATCH_TOKEN);
    console.log("GitHub workflow dispatch accepted (HTTP 204)");
  },
};
