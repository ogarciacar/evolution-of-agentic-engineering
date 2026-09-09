# Maintained documentation

These documents describe the active research and publication architecture.

- [Research publication pipeline](../pipeline/README.md) — validation, derived-artifact generation, D1 projection, and the boundary between repository infrastructure and GitHub Actions orchestration.
- [Evidence projection contract](evidence-projection.md) — deterministic mapping from canonical YAML evidence to the queryable D1-compatible projection.
- [Evidence claim mapping decisions](evidence-claim-mapping-decisions.md) — active interpretation rules for mapping evidence to model claims.
- [CI-owned derived artifacts](ci-owned-derived-artifacts.md) — ownership boundaries between authored files, generated artifacts, and runtime publication.
- [Rebuild invariant](rebuild-invariant.md) — recovery contract requiring the D1 projection to be reproducible from canonical repository state.
- [AI Search experiment](ai-search-experiment.md) — isolated Cloudflare AI Search retrieval experiment over the published evidence corpus.
- [Query examples](query-examples.sql) — example SQL for interrogating the evidence projection.

Historical implementation-slice notes have been removed from `docs/`; Git history remains the source for those decisions.
