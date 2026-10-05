const ORIGIN = 'https://agenticengineering.science';
export const EVIDENCE_LIMITS = Object.freeze({ sources: 5, passagesPerSource: 3, candidates: 100, passageBytes: 12000 });

function canonicalSource(key) {
  if (typeof key !== 'string' || !key.trim()) return null;
  try {
    const url = new URL(key, ORIGIN);
    if (url.origin !== ORIGIN || url.username || url.password) return null;
    const path = url.pathname.replace(/\/+$/, '');
    if (path === '/practices') return { url: `${ORIGIN}/practices`, kind: 'eae_collection', record_id: null };
    // Published evidence IDs are single path segments. Reject encoded separators.
    const match = path.match(/^\/signals\/([a-zA-Z0-9_-]+)$/);
    if (!match) return null;
    return { url: `${ORIGIN}${path}/`, kind: 'eae_signal', record_id: match[1] };
  } catch { return null; }
}

async function digest(value) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

// Text is stored exactly as returned by the index. The hashes identify that
// retrieved content, not its truth, independence, or freshness.
export async function buildEvidencePackage(chunks) {
  if (!Array.isArray(chunks)) throw new Error('Invalid retrieval response');
  const sources = new Map();
  const seen = new Set();
  let truncated = chunks.length > EVIDENCE_LIMITS.candidates;
  let omitted = false;
  for (const chunk of chunks.slice(0, EVIDENCE_LIMITS.candidates)) {
    const source = canonicalSource(chunk?.item?.key);
    const text = chunk?.text;
    if (!source || typeof text !== 'string' || !text.trim()) continue;
    if (new TextEncoder().encode(text).byteLength > EVIDENCE_LIMITS.passageBytes) {
      truncated = omitted = true;
      continue;
    }
    const fingerprint = JSON.stringify([source.url, text]);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    let record = sources.get(source.url);
    if (!record) {
      if (sources.size >= EVIDENCE_LIMITS.sources) { truncated = omitted = true; continue; }
      record = {
        id: `source:${await digest(source.url)}`,
        ...source,
        title: source.kind === 'eae_collection' ? 'Emerging Practices'
          : typeof chunk.item.metadata?.title === 'string' ? chunk.item.metadata.title.trim().slice(0, 500) : null,
        passages: [],
      };
      sources.set(source.url, record);
    }
    if (record.passages.length >= EVIDENCE_LIMITS.passagesPerSource) { truncated = omitted = true; continue; }
    record.passages.push({ id: `passage:${await digest(fingerprint)}`, text });
  }
  const values = [...sources.values()];
  return {
    version: 1,
    outcome: values.length ? 'evidence_found' : omitted || truncated ? 'evidence_unavailable' : 'no_matching_evidence',
    provenance: 'indexed_eae_pages',
    retrieved_at: new Date().toISOString(),
    indexed_at: null,
    truncated,
    limits: EVIDENCE_LIMITS,
    sources: values,
  };
}
