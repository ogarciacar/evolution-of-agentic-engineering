# Oracle Amsterdam A1 hourly capacity watch

This standalone GitHub Actions workflow checks host capacity for an Oracle Always Free-eligible **VM.Standard.A1.Flex, 2 OCPUs, 12 GiB RAM** in the tenancy's Amsterdam home region (`eu-amsterdam-1`). It matches the saved Oracle Resource Manager stack `eae-inference-oracle-a1`.

**No virtual machines are created or modified.** No containers or applications are deployed. The availability report is not a reservation and cannot guarantee Always Free eligibility or the ability to provision a VM afterward.

## Activate

1. GitHub repository **Settings → Secrets and variables → Actions** must contain `ORACLE_TENANCY_OCID`, `ORACLE_USER_OCID`, `ORACLE_API_FINGERPRINT` and `ORACLE_API_PRIVATE_KEY`. Never commit or disclose private key contents.
2. Merge this monitoring-only PR into `main`. GitHub scheduled workflows run only from the default branch.
3. Open **Actions → Oracle A1 capacity watch → Run workflow** for the first test.
4. Check the run logs. The report should show `AVAILABLE` or `OUT_OF_HOST_CAPACITY`. If a permissions error occurs, correct Oracle IAM permissions for listing availability domains and generating Compute Capacity Reports.
5. Ensure repository issue-assignment notifications are enabled for the owner.

## Behavior

- Checks once per hour at approximately minute 17 (GitHub Actions schedule execution may be delayed).
- Checks the root tenancy in `eu-amsterdam-1`; finds its AD-1 using Oracle IAM API.
- Reports the requested 2-OCPU / 12-GiB flexible shape.
- Only an explicit `AVAILABLE` is considered positive, with `available-count: null` accepted because Oracle can report null even with an AVAILABLE status.
- Opens a **single GitHub issue**, assigning it to the repository owner when a positive result appears. To avoid repeat notifications, the workflow checks all existing issues for its exact title.
- Other statuses do not trigger an issue. API failures fail the Actions job instead of claiming "no capacity".

**Limitation:** GitHub Actions scheduling and issue notifications are not instant. Even if the report returns AVAILABLE, the VM may fail to provision by the time you attempt it. Repeated future alerts will not be issued while an issue with the same title exists (even if closed).

Oracle CLI command: https://docs.oracle.com/en-us/iaas/tools/oci-cli/latest/oci_cli_docs/cmdref/compute/compute-capacity-report/create.html
