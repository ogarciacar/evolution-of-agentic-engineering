# S2 design summary

S2 introduces the first database-shaped representation of the research corpus while keeping the repository architecture intentionally asymmetric:

- YAML is optimized for authored, reviewable evidence records.
- The projection is optimized for questions across many evidence records.
- Stages and conditions are normalized because they are recurring query dimensions.
- Narrative lists remain JSON because there is not yet evidence that relational normalization would improve a real research query.
- The projection is constrained by the same controlled vocabularies as the canonical schema where practical.

The result should be understood like a compiled representation: useful to execute queries against, cheap to recreate, and never authoritative over its source.
