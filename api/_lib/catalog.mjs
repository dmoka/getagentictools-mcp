/**
 * Catalog access for the MCP function: fetch /data/agent/*.json from our own
 * CDN, cache in module memory.
 *
 * Why fetch-own-CDN instead of bundling src/data: the raw catalog is ~70MB
 * (bodies included) — a 1–2s parse and ~500MB RSS per cold start. The agent
 * files are body-less (~28MB total), CDN-cached, and generated from the same
 * collections in the same deploy as the site, so a warm function fetching
 * production always sees exactly the live catalog.
 *
 * Fluid Compute reuses instances across requests, so the module cache is a
 * real cache, not a per-request fiction. TTL guards the post-deploy window:
 * an instance that outlives a deploy picks up new data within 15 minutes.
 */

const ORIGIN = process.env.AGENT_DATA_ORIGIN || 'https://getagentictools.com';
export const CATEGORIES = ['skills', 'mcp', 'plugins', 'loops'];
const TTL_MS = 15 * 60 * 1000;

const cache = new Map(); // key → { at, data }

async function fetchJson(path) {
  const res = await fetch(`${ORIGIN}${path}`);
  if (!res.ok) throw new Error(`fetch ${path}: HTTP ${res.status}`);
  return res.json();
}

async function cached(key, loader) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;
  const data = await loader();
  cache.set(key, { at: Date.now(), data });
  return data;
}

/** Entries for one category (decorated with absolute url + ref=mcp). */
export async function loadCategory(category) {
  return cached(`cat:${category}`, async () => {
    const { entries } = await fetchJson(`/data/agent/${category}.json`);
    for (const e of entries) e.url = `${ORIGIN}${e.href}?ref=mcp`;
    return entries;
  });
}

/** All categories, or one when `category` is given. */
export async function loadEntries(category = null) {
  if (category) return loadCategory(category);
  const all = await Promise.all(CATEGORIES.map(loadCategory));
  return all.flat();
}

/** Enriched SKILL.md facts, id → {capabilities, prerequisites, configKeys}. */
export async function loadEnriched() {
  return cached('enriched', async () => {
    const { facts } = await fetchJson('/data/agent/enriched-skills.json');
    return facts;
  });
}
