# Evidence identity in the projection

Canonical evidence identity is the repository artifact name, not a second identifier stored inside YAML.

For example:

```text
evidence/2026-09-03-cursor-pstack.yaml
                  ↓
evidence_id = 2026-09-03-cursor-pstack
```

The projection also records `github_path` so every row can be traced back to the canonical artifact. Renaming an evidence YAML therefore changes its identity and should be treated as an intentional migration, not routine metadata editing.
