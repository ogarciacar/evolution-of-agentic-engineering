# Projection boundary

The D1 projection exists to make accumulated evidence queryable. It is not part of the evidence-authoring contract.

The dependency direction is one-way:

```text
evidence/*.yaml  →  projection  →  queries
   canonical         derived
```

A query result may inform future research or a later YAML assessment, but application code must not mutate canonical evidence through D1. This boundary prevents the repository and database from becoming competing sources of truth.
