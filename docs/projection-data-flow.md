# Projection data flow

```text
public source
     ↓
reviewed evidence/*.yaml
     ↓
JSON Schema validation
     ↓
deterministic projection
     ↓
D1 / SQLite query representation
     ↓
research queries and future read APIs
```

S2 defines the bottom representation and verifies compatibility. S3 will implement the deterministic projection step.
