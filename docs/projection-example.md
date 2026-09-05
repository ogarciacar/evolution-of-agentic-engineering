# Projection example

Canonical artifact:

```text
evidence/2026-09-03-cursor-pstack.yaml
```

becomes one `evidence` row with:

```text
evidence_id = 2026-09-03-cursor-pstack
github_path = evidence/2026-09-03-cursor-pstack.yaml
producer = Cursor
source_type = repository
provenance = primary
verdict = REFINES
```

and separate rows for each mapped stage and Selection condition. The source YAML remains unchanged and authoritative.
