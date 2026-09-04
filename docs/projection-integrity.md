# Projection integrity checks

S2 adds two complementary CI checks.

The schema check verifies that the migration is executable by SQLite, expected tables and indexes exist, foreign keys cascade, JSON columns reject invalid JSON, and a representative stage/condition/verdict join works.

The corpus check then loads every current canonical YAML record into an ephemeral database. This catches drift between the JSON Schema evidence contract and the SQL projection contract before a real D1 database exists.

Neither check writes a persistent database or changes generated website artifacts.
