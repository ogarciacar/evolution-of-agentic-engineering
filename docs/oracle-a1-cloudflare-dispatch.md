# Cloudflare Cron for Oracle A1 Capacity Watch

This Worker schedules the **existing** GitHub workflow `.github/workflows/oracle-a1-capacity-watch.yml`. It checks **no Oracle API directly** and requires **no Oracle credentials**. It dispatches the existing job for **VM.Standard.A1.Flex, 2 OCPUs / 12 GiB, eu-amsterdam-1**. No VMs are created.

## Why

GitHub's native scheduled triggers can be delayed or dropped. Cloudflare Workers Free supports Cron Triggers, so this experiment uses Cloudflare for the hourly clock and keeps GitHub for execution, logs, and capacity-notification issues. The dispatch returning HTTP 204 guarantees only that GitHub accepted the event, **not** that the workflow executed.

## One-time setup

1. On GitHub, go to **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token** (https://github.com/settings/personal-access-tokens/new). Choose resource owner `ogarciacar`, **Only select repositories** → `evolution-of-agentic-engineering`, and repository permission **Actions: Read and write**. All unrelated permissions should be left off. Set a sensible expiration and plan to rotate the token before it expires. Save the token securely; do not put it in a repository, chat, or terminal command history.
2. Merge the Cloudflare dispatcher PR so GitHub recognizes the optional `dispatch_origin` workflow input. **Do not remove the existing GitHub cron yet.**
3. From the repository root on your machine, log in to the correct Cloudflare account if needed with `npx --yes wrangler@4 login`. Verify account with `npx --yes wrangler@4 whoami`.
4. Deploy the separate, scheduled-only Worker (no public HTTP endpoint):
   ```sh
   npx --yes wrangler@4 deploy --config workers/oracle-capacity-dispatch/wrangler.toml
   ```
5. Add its secret interactively, without committing or pasting the token in the command:
   ```sh
   npx --yes wrangler@4 secret put GITHUB_DISPATCH_TOKEN --config workers/oracle-capacity-dispatch/wrangler.toml
   ```
   Enter the GitHub fine-grained PAT when prompted. The first scheduled attempt may fail if it occurs before the secret exists.

## Verification

- Initial Cloudflare trigger: **minute 37 of each hour, UTC**. GitHub's original cron remains at minute 17 during validation. Cloudflare Cron Trigger changes may take up to 15 minutes to propagate.
- Open Cloudflare dashboard → Workers & Pages → `eae-oracle-capacity-dispatch` → Settings → Triggers. Confirm the hourly Cron Trigger and secret configuration (do not reveal secret values).
- Look for a GitHub Actions run of **Oracle A1 capacity watch (cloudflare-cron)** around the next :37 tick. The GitHub API labels both external and manual dispatch events `workflow_dispatch`; the explicit run name differentiates them.
- Confirm the GitHub job reaches the Oracle availability report successfully, and the Cloudflare Worker logs show `GitHub workflow dispatch accepted (HTTP 204)`.
- An `OUT_OF_HOST_CAPACITY` result is a healthy *check* and does not indicate a scheduler failure.

### After successful verification

Use a separate follow-up PR to remove only the `schedule:` event from `.github/workflows/oracle-a1-capacity-watch.yml`. Keep `workflow_dispatch`, OCI secrets in GitHub, deduplicated GitHub issue notifications, and the Terraform stack unchanged. Until the native cron is removed, both timers may run, producing extra but harmless Oracle capacity reports.

## Security and limitations

- No public HTTP endpoint: `workers_dev = false`; the Worker only exports a scheduled handler.
- No secrets in version control. The GitHub token is scoped to this repository and must have **Actions: write**; it can operate GitHub Actions within this repository, so protect and rotate it.
- The Worker logs **only** HTTP status, never GitHub response bodies or credentials.
- Cloudflare and GitHub are both best-effort schedulers/executors. GitHub 204 does not imply that a runner has started; if stronger guarantees are required, add a separately monitored heartbeat/missing-run alert.
- On Workers Free, Cron Triggers and invocations are subject to shared account limits; this tiny hourly dispatcher should remain well within the free allowance. Existing paid-plan commitments or other account usage are separate.
- Monitor GitHub Actions for missing runs and Cloudflare logs for dispatch failures. If the token expires, dispatch will fail until rotated.
- To stop Cloudflare scheduling, remove `[triggers]`/`crons` in this Wrangler config and redeploy, or disable the trigger in the dashboard. For a Wrangler-managed Worker, keep its Wrangler configuration as the source of truth.
