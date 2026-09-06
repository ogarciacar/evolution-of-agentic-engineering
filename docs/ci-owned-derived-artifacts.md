# CI-owned derived artifacts

Evidence contributions author canonical research state. Evidence integrity CI owns deterministic generated projections.

The workflow validates canonical inputs, runs `scripts/build-derived-artifacts.py`, and for same-repository pull requests commits only the known generated paths back to the pull-request head branch. The resulting push starts a second run, which must regenerate no diff.

Fork pull requests remain read-only: generation can verify their proposed canonical state, but CI does not push into contributor forks.

This makes a canonical-only evidence contribution the acceptance case: no contributor-side generation is required before opening the pull request.
