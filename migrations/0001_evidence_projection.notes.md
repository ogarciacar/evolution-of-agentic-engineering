# 0001 evidence projection

The first projection deliberately normalizes only dimensions with demonstrated cross-corpus query value: stages and Selection conditions.

`observed` and `what_this_does_not_establish` remain lossless JSON arrays in `evidence`. They can be normalized later if concrete research queries justify it.

Transition fields remain nullable columns because each evidence record has at most one transition in the canonical contract. `presentation.summary` is nullable because it is optional in canonical YAML.

This schema is a projection contract, not an application-owned persistence model.
