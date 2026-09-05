# Evidence projection migrations

These migrations define the SQLite-compatible schema intended for the future Cloudflare D1 evidence projection.

They do not imply that D1 is a source of truth. Canonical evidence remains in `evidence/*.yaml`; the database is designed to be deleted and deterministically rebuilt from those records.

Apply migrations in filename order. Population is intentionally outside S2 and will be implemented by the deterministic indexer in the next slice.
