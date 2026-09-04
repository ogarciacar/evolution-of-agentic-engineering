# Projection failure modes

The projection contract is designed to make several mistakes fail early:

- a YAML vocabulary value not representable by SQL constraints;
- a malformed narrative JSON projection;
- a stage or condition row without a parent evidence record;
- duplicate stage/condition mappings for one evidence item;
- projection schema drift that prevents one of the current canonical records from loading.

S3 will add operational failure modes such as stale rows and non-idempotent rebuilds.
