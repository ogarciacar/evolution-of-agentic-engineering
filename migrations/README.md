# Evidence projection migrations

These migrations define the SQLite/D1 schema used by the evidence read model.

D1 is a deterministic projection, not a source of truth. Canonical evidence remains in `evidence/*.yaml`; projection state may be deleted and rebuilt from canonical repository state.

Apply migrations in filename order. The publication pipeline under `pipeline/projection/` rebuilds or exports projection state from the accepted evidence corpus, and GitHub Actions applies the migration chain before synchronizing production or preview D1 projections.

Migration files are retained as the schema-evolution history of the persisted projection and must not be collapsed merely because the current database can be rebuilt from scratch.
