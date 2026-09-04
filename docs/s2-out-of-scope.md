# S2 scope boundary

S2 stops at the representation boundary.

It deliberately does not:

- create or configure a Cloudflare D1 database;
- persist projected evidence anywhere;
- implement production synchronization;
- introduce Cloudflare credentials or secrets;
- add an Evidence API;
- add R2;
- change public pages;
- change the canonical YAML evidence contract.

The only executable database used by S2 is an ephemeral in-memory SQLite database in CI for contract verification.
