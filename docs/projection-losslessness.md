# Projection losslessness

For S2, lossless means every value in the current canonical evidence contract has a deterministic representation in the projection.

It does not mean the SQL rows alone replace the YAML serialization. YAML remains authoritative for formatting, authored structure, review history, and future contract evolution.

The projection preserves optional values as `NULL`, scalar values as typed/constrained columns, mapped many-valued dimensions as child rows, and ordered narrative arrays as JSON text.
