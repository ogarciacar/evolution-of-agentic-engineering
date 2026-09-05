# Repository scripts

Evidence integrity includes two checks for the future D1 projection:

- `check-evidence-projection.py` verifies that the migration creates the expected SQLite/D1-compatible schema, constraints, indexes, cascade behavior, and representative query shape.
- `test-evidence-projection.py` projects every canonical `evidence/*.yaml` record into an in-memory SQLite database and verifies that the full current corpus is representable.

These scripts do not connect to Cloudflare or persist a database. The deterministic production indexer is intentionally deferred to the next slice.
