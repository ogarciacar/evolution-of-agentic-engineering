# Oracle Always Free Ampere capacity watch

Workflow: `.github/workflows/oracle-a1-capacity-watch.yml`.

**Scope:** Once per hour, use Oracle's authenticated **Compute Capacity Report** API to check `VM.Standard.A1.Flex` with **2 OCPUs / 12 GiB RAM** in home region `eu-amsterdam-1`. No instance is created or reserved. If available_count > 0 and status is AVAILABLE, open one GitHub issue to notify maintainers (GitHub issue notifications must be enabled). All other states and API errors do not claim capacity.

**Important:** GitHub scheduled workflows only run from the default branch. Until this PR is merged and credentials are added, monitoring is NOT active. Scheduled runs may be delayed or skipped by GitHub.

## Setup (never paste credentials into a PR or chat)

1. In OCI Console, create an API signing key for a user permitted to list availability domains and create compute capacity reports. Scope IAM policy as narrowly as your tenancy permits. This key grants access to your cloud account—treat it as sensitive.
2. In GitHub repository **Settings → Secrets and variables → Actions**, configure:
   - `ORACLE_TENANCY_OCID` (root tenancy identifier, not the VCN OCID)
   - `ORACLE_USER_OCID`
   - `ORACLE_API_FINGERPRINT`
   - `ORACLE_API_PRIVATE_KEY` (entire PEM private key; keep newlines)
3. Merge the PR only after workflow review, then start one manual **Actions → Oracle A1 capacity watch → Run workflow** test.
4. Check that it returns capacity status successfully. If report permissions are denied, grant only the required API actions.
5. Enable GitHub issue notifications on this repo so the issue reaches you.
6. If an issue appears when capacity is reported, provision the VM promptly. A positive report is not a reservation; provisioning can still fail.

## Security and caveats

- API keys stay in GitHub Actions encrypted secrets, not source code or build artifacts.
- The workflow does **not** create/terminate/modify VMs or modify network configuration.
- Only `eu-amsterdam-1` is checked. The capacity report indicates physical host availability, not Always Free quota or a guarantee of successful VM creation.
- The issue is intentionally created only once; close or delete it to review the result but further alerts require manually removing the prior issue because this workflow deduplicates across all issue states.
- The watch checks the full **2 OCPU / 12 GiB** Always Free A1 target and matches the already-saved Oracle stack.
- Capacity reports are a point-in-time signal and can be stale by the time a provisioning request is made.

Oracle reference: https://docs.oracle.com/en-us/iaas/tools/oci-cli/latest/oci_cli_docs/cmdref/compute/compute-capacity-report/create.html
