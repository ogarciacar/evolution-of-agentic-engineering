# Rebuild invariant

The strongest recovery test for the evidence projection is intentionally destructive:

1. delete the projected database;
2. apply repository migrations in order;
3. read every canonical `evidence/*.yaml` record from `main`;
4. deterministically project the records;
5. obtain the same queryable state.

If a future feature requires information that cannot survive this test, that information belongs in the canonical repository contract (or another explicitly canonical artifact), not only in D1.
