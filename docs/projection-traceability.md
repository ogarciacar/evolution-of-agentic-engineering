# Projection traceability

Every projected evidence row carries both `evidence_id` and `github_path`.

This means a query result can always be traced back to the reviewed canonical artifact that produced it. Future APIs should preserve that traceability rather than returning database-only identifiers with no repository referent.
