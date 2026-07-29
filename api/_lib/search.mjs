/**
 * Deterministic catalog search — same scoring contract as the agentictools
 * CLI (dmoka/agentictools-cli), evolved with a description field the CLI's
 * index doesn't carry.
 *
 * Two rules are load-bearing, both from a live pre-publish bug (2026-07-28):
 *
 * 1. MAX per token across fields, never a sum. Summing let a stub fork whose
 *    tagline repeats its own title ("tdd" / "tdd") stack tagline points on
 *    top of exact-title and outrank the 501k-install original. Self-repeating
 *    content must not be able to game the scorer.
 * 2. Popularity is a tiebreak (log-scaled, caps ≈ +7), never the ranking —
 *    and stub entries lose exact ties to real ones.
 *
 * AND semantics: every query token must match somewhere.
 */

const WEIGHTS = {
  titleExact: 100,
  titlePrefix: 40,
  titleSubstring: 25,
  tagExact: 15,
  authorExact: 10,
  taglineSubstring: 8,
  descriptionSubstring: 4,
};

function tokenScore(entry, token) {
  let score = 0;
  const title = entry.title.toLowerCase();
  if (title === token) score = Math.max(score, WEIGHTS.titleExact);
  else if (title.startsWith(token)) score = Math.max(score, WEIGHTS.titlePrefix);
  else if (title.includes(token)) score = Math.max(score, WEIGHTS.titleSubstring);

  if (entry.tags?.some((t) => t.toLowerCase() === token)) score = Math.max(score, WEIGHTS.tagExact);
  if (entry.author && entry.author.toLowerCase() === token) score = Math.max(score, WEIGHTS.authorExact);
  if (entry.tagline?.toLowerCase().includes(token)) score = Math.max(score, WEIGHTS.taglineSubstring);
  if (entry.description?.toLowerCase().includes(token)) score = Math.max(score, WEIGHTS.descriptionSubstring);

  return score;
}

export function search(entries, query, { limit = 10 } = {}) {
  const tokens = String(query).toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { total: 0, results: [] };

  const scored = [];
  for (const entry of entries) {
    let total = 0;
    let matchedAll = true;
    for (const token of tokens) {
      const s = tokenScore(entry, token);
      if (s === 0) {
        matchedAll = false;
        break;
      }
      total += s;
    }
    if (!matchedAll) continue;
    total += Math.log10(entry.stars + entry.downloads + 10);
    scored.push({ entry, score: total });
  }

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      (a.entry.stub ? 1 : 0) - (b.entry.stub ? 1 : 0) ||
      a.entry.title.localeCompare(b.entry.title),
  );
  return { total: scored.length, results: scored.slice(0, limit).map((r) => r.entry) };
}
