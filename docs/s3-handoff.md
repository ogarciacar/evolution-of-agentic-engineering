# S3 handoff

S3 should turn the representation defined in S2 into a deterministic indexer.

Its core acceptance test should be idempotence:

```text
canonical YAML + migrations → projection A
canonical YAML + migrations → projection B
projection A == projection B
```

S3 should own parsing, deterministic inserts/upserts, deletion of stale projected rows, transaction boundaries, and a local rebuild command. Cloudflare deployment can remain a later concern until deterministic rebuilding is proven locally.
