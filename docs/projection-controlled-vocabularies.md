# Projection controlled vocabularies

The SQL projection repeats the canonical controlled vocabularies for fields where invalid values would make cross-corpus queries unreliable.

This includes producer type, source type, provenance, scale label, model implication verdict, evolutionary stage, and Selection condition.

The YAML JSON Schema remains the canonical definition. Repeating the constraints in SQL is defensive integrity for the derived representation, not a second place to author vocabulary changes. A vocabulary change should therefore update the canonical schema first and the projection migration second.
