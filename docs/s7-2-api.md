# S7.2 API shape

The evidence read API exposes the projected relationship ledger on every record:

```json
{
  "claims": [
    {"id": "C02", "relationship": "REFINES"}
  ]
}
```

This is projection data, not an inferred API result. The array is reconstructed from `model/evidence-claims.yaml` through D1 and ordered by claim ID.

S7.2 adds no claim filter and no aggregate claim verdict endpoint. Those belong to claim-level evaluation, not relationship storage.
