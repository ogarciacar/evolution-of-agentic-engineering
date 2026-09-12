# Maintained documentation

These documents describe the active research and publication architecture.

- [Research publication pipeline](../pipeline/README.md) — validation, build-time publication generation, D1 projection, and the boundary between repository infrastructure and GitHub Actions orchestration.
- [Evidence projection contract](evidence-projection.md) — deterministic mapping from canonical YAML evidence to the queryable D1-compatible projection.
- [Evidence claim mapping decisions](evidence-claim-mapping-decisions.md) — active interpretation rules for mapping evidence to model claims.
- [Deterministic publication outputs](ci-owned-derived-artifacts.md) — ownership boundaries between canonical files, build-time outputs, and runtime publication.
- [Rebuild invariant](rebuild-invariant.md) — recovery contract requiring the D1 projection to be reproducible from canonical repository state.
- [AI Search](ai-search.md) — current Cloudflare AI Search architecture, corpus boundary, public retrieval contract, and deployment model.
- [AI Search retrieval evaluation](../experiments/ai-search/README.md) — stable evaluation queries, relevance judgments, production baseline, and benchmark contract.
- [Query examples](query-examples.sql) — example SQL for interrogating the evidence projection.

Historical implementation-slice notes are consolidated outside maintained architecture docs; Git and pull-request history preserve detailed implementation decisions.
