# Slice 5L — Vector-only retrieval

## Question

Does forcing vector-only retrieval improve semantic ranking precision over the merged Slice 5H hybrid + keyword-OR baseline without regressing retrieval reliability, top-five recall, or latency?

## Starting condition

Slice 5H is merged and deployed. Slice 5K established the production benchmark:

- reliability: 30/30 non-zero attempts, 10/10 stable, 0 errors
- Hit@1: 0.667
- Hit@5: 1.000
- MRR: 0.775
- median latency roughly 0.9 s

The main ranking weaknesses are Q06 (Spotify evidence starts at rank 2), Q09 (organizational-context evidence at rank 5), and Q10 (relevant evidence often below rank 1).

## Change

Change exactly one retrieval dimension in the Worker:

- keep namespace binding and `env.AI_SEARCH.get("agentic-engineering-search")`
- keep `messages` input
- force `ai_search_options.retrieval.retrieval_type` to `"vector"`
- remove `keyword_match_mode: "or"` because keyword matching is not used in vector-only retrieval
- keep all remaining instance defaults unchanged
- keep the public response capped locally at five unique source pages

Cloudflare documents `retrieval_type: "vector"` as the per-request override for vector-only retrieval.

## Hypothesis

Hybrid + keyword-OR solved natural-language recall but introduced broad lexical candidates that sometimes outrank semantically closer evidence. Vector-only retrieval may improve top-rank semantic precision by removing the keyword branch and hybrid fusion from this request.

## Acceptance

Keep Slice 5L only if repeated production characterization shows:

- 30/30 non-zero attempts
- 0 request/API errors
- Hit@5 remains 1.000
- Hit@1 materially improves over 0.667
- MRR materially improves over 0.775
- latency does not materially regress from the ~1 s 5H baseline
- representative rankings remain plausible across the full Q01–Q10 benchmark, not only Q06

A small or noisy precision gain is not enough to accept the slice.

## Deliberately unchanged

- AI Search index / sync
- corpus and path filters
- embedding model
- vector match threshold
- max result count
- context expansion
- query rewriting
- reranking
- public response schema
- UI
- visitor retry behavior
- precision judgments

No AI Search sync is required.
