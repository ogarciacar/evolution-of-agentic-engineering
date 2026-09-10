# AI Search experiment log

This file preserves the compact decision history for the Cloudflare AI Search experiment. Detailed implementation evidence remains in Git and pull-request history.

The active architecture and production contract live in [`docs/ai-search.md`](../../docs/ai-search.md). The stable evaluation contract lives in [`README.md`](README.md).

| Slice | Intervention / question | Decision | Evidence / conclusion |
| --- | --- | --- | --- |
| 1 | Companion Worker + `/api/search` retrieval proof | Keep | Sitemap-based AI Search returned real on-site evidence through the Worker boundary. |
| 2 | Minimal `Ask the evidence` UI | Keep | Retrieval-only visitor surface; no generated answers. |
| 3 | Fixed ten-query production evaluation corpus | Keep | Established reproducible mechanical retrieval evaluation. |
| 4A / PR #135 | Add `/practices` to searchable sitemap surface | Keep | Dependency-lineage and code-search queries gained explicit practice evidence. |
| 4B | Restrict AI Search paths to `**/signals/**` and `**/practices` | Keep | Removed generic `/evidence` retrieval pollution. |
| 4C / PR #136 | Deduplicate source pages at API boundary | Keep | Duplicate-source queries dropped to zero without backfilling beyond returned candidates. |
| 4D / PR #137 | Result presentation hygiene | Keep | Improved public retrieval presentation without changing ranking. |
| 4E / PR #138 | Align result cards with evidence UI | Keep | UI-only consolidation; retrieval unchanged. |
| 5A / PR #139 | Repeated reliability characterization | Keep tooling | Demonstrated intermittent zero results under the earlier retrieval configuration and separated zero/error/stable states. |
| 5B / PR #140 | Bounded zero-result retry | Reject | Could not establish retry as a clean fix; production had already drifted to widespread zero results before the intervention. |
| 5C / PR #141 | Namespace binding + `query` request form | Reject | 6/30 non-zero in production. |
| 5D / PR #142 | Direct binding + `messages` request form | Reject | 5/30 non-zero in production. |
| 5E / PR #143 | Namespace + `messages` + explicit retrieval options | Reject | 5/30 non-zero in production. |
| 5F / PR #144 | Namespace + `messages` + instance defaults | Reject | Same deployed code varied materially over time; useful as evidence of retrieval variability, not a stable production choice. |
| 5G / PR #145 | Playground-parity diagnostic (`Spotify` vs natural-language Spotify question) | Diagnostic only | Exact keyword was stable while natural-language phrasing was unreliable, focusing investigation on retrieval/query behavior. Closed unmerged. |
| 5H / PR #146 | `keyword_match_mode: "or"` | **Keep — production baseline** | Repeated 30/30 non-zero, 10/10 stable behavior with ~1 s latency. Solved the observed natural-language recall failure in current production measurements. |
| 5I / PR #147 | Cloudflare reranker with default threshold | Reject | Recall collapsed to 15/30; several queries became persistent-zero. |
| 5J / PR #148 | Same reranker with threshold `0` | Reject | Recall returned to 30/30 and Spotify ranking improved, but broader ranking quality regressed. |
| 5K / PR #149 | Frozen precision judgments + Hit@1 / Hit@5 / MRR evaluator | Keep tooling | Established a human-reviewable ranking benchmark. Initial 5H baseline: Hit@1 0.667, Hit@5 1.000, MRR 0.775. |
| 5L / PR #150 | Vector-only retrieval | Reject | Precision gain was inside/near normal baseline variance while reliability and latency regressed. |
| 5M / PR #151 | Five-run 5H variance characterization | **Keep — measurement baseline** | 150/150 non-zero; Hit@5 1.000; Hit@1 range 0.633–0.733; MRR range 0.740–0.827. Established that ranking has meaningful natural variance. |
| 5N / PR #152 | Deterministic lexical reranking of the same five sources | Reject | 150/150 reliable and Hit@5 unchanged, but aggregate Hit@1 reached only 0.733, exactly the prior upper envelope; improved Q06/Q09 while regressing Q07 and not fixing Q10. |
| 5O | Repository consolidation | Current | Replace slice-by-slice maintained docs with current architecture + stable evaluation contract + this compact log; separate deterministic PR contracts from live production benchmarking. |

## Current conclusion

The supported production retrieval design is intentionally small:

```text
published signals + practices
        ↓
Cloudflare AI Search hybrid retrieval
        ↓
per-request keyword OR
        ↓
source-URL deduplication
        ↓
at most five on-site retrieval results
```

The corpus is retrievable and Hit@5 has been stable across the frozen benchmark. Remaining work should be treated as ranking-quality research, not as a general connectivity or corpus-recall problem.

## Guardrails learned

- Change one retrieval variable at a time.
- Do not infer causality from a single run; 5M demonstrated natural ranking variance.
- Do not re-index for request-level retrieval experiments.
- Do not add visitor retries to hide upstream retrieval behavior.
- Do not merge an experiment that improves one query class by predictably degrading another.
- Preserve canonical evidence → validation → D1 projection → website → AI Search. AI Search remains derived retrieval infrastructure only.
