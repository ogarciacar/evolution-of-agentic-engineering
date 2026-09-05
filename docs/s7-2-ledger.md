# Claim mapping ledger ownership

`model/evidence-claims.yaml` belongs to the model layer, not the source-evidence layer.

This separation is deliberate. An evidence record should remain a stable account of a source, its observations, boundaries, and the interpretation made when it was incorporated. Claim definitions can later be refined, split, or replaced. Keeping the relationship ledger beside the claims allows those model-relative assertions to evolve without rewriting the underlying evidence record.

The ledger is still canonical GitHub data. D1 contains only its query projection and can be rebuilt from the repository.
