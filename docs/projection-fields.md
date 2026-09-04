# Projection field rationale

The `evidence` table retains enough information to represent the complete current evidence record while making common scalar dimensions directly queryable.

`observed_json` and `limitations_json` intentionally preserve ordered arrays as JSON text. Their order and wording are part of the evidence assessment, while no current cross-corpus query requires one row per item.

`transition_from`, `transition_to`, and `adjacent_stage` are scalar because the canonical contract permits at most one transition object per evidence record.

`assisted_by_ai` is represented as constrained integer `0`/`1`, matching SQLite/D1's conventional boolean representation.
