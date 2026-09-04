# Projection security boundary

S2 introduces no credentials, network database access, Cloudflare bindings, or deployment configuration.

The CI checks operate only on repository content and an in-memory SQLite database. This keeps the first projection slice independent of Cloudflare account state and prevents infrastructure credentials from being introduced before a deterministic local projection exists.
