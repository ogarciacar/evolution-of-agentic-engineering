# Projection query model

The initial projection is designed around cross-corpus research dimensions already present in the working model:

- time (`source_date`);
- producer;
- model implication (`verdict`);
- evolutionary stage;
- Selection condition.

These dimensions support both evidence discovery and model interrogation without embedding conclusions in the database. In particular, `CONTRADICTS` and `INCONCLUSIVE` are first-class verdict values alongside `SUPPORTS` and `REFINES`; the projection must not optimize only for confirming evidence.
