# Projection versioning

Projection schema evolution is expressed as ordered SQL migrations under `migrations/`.

A migration changes the derived query representation; it does not by itself change the canonical YAML evidence contract. If a future projection change requires new canonical information, the YAML schema and contribution contract should evolve first, followed by a projection migration.

This ordering preserves the rule that the projection follows the evidence corpus rather than becoming its source.
