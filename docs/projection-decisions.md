# S2 projection decisions

- Keep the flat `evidence/` directory; producer is metadata, not repository hierarchy.
- Derive identity from the existing evidence filename rather than duplicating `id` inside YAML.
- Keep D1 disposable and rebuildable from GitHub.
- Normalize stages and conditions because they have demonstrated cross-corpus query value.
- Keep narrative arrays as JSON until a real query justifies additional tables.
- Keep contradiction and inconclusive evidence first-class in the query model.
- Validate against SQLite before creating Cloudflare infrastructure.
