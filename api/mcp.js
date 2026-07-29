/**
 * The getagentictools MCP server — https://getagentictools.com/api/mcp
 *
 * Remote Streamable HTTP, stateless (no sessions, no Redis): every catalog
 * question is answerable from one request. Data comes from /data/agent/*.json
 * on our own CDN (generated from the same collections in the same deploy as
 * the site), cached in module memory — see api/_lib/catalog.mjs.
 *
 * Deterministic by design: no LLM calls, no personalization. Every result row
 * carries the tool's getagentictools.com URL — that URL is how agents cite
 * and how users arrive.
 */
import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import { loadEntries, loadEnriched, CATEGORIES } from './_lib/catalog.mjs';
import { search } from './_lib/search.mjs';
import { ecosystemStats } from './_lib/stats.mjs';

const SITE = 'https://getagentictools.com';
const categoryEnum = z.enum(['skills', 'mcp', 'plugins', 'loops']);

/** Compact result row — agents pay tokens for every byte we return. */
function row(e) {
  return {
    id: `${e.category}/${e.id}`,
    title: e.title,
    category: e.category,
    tagline: e.tagline,
    author: e.author,
    stars: e.stars,
    downloads: e.downloads,
    ...(e.lastUpdated ? { lastUpdated: e.lastUpdated } : {}),
    ...(e.tags?.length ? { tags: e.tags.slice(0, 5) } : {}),
    ...(e.installCommand ? { install: e.installCommand } : {}),
    url: e.url,
  };
}

const json = (payload) => ({ content: [{ type: 'text', text: JSON.stringify(payload) }] });

const CAT_META = {
  skills: { label: 'Agent Skills', blurb: 'SKILL.md packages that give agents new capabilities.' },
  mcp: { label: 'MCP Servers', blurb: 'Model Context Protocol servers that connect agents to the world.' },
  plugins: { label: 'Claude Code Plugins', blurb: 'Plugins bundling commands, agents, and hooks.' },
  loops: { label: 'Agentic Loops', blurb: 'Repeatable agent workflows that iterate until an exit condition.' },
};

const handler = createMcpHandler(
  (server) => {
    server.tool(
      'search_tools',
      'Search 41,000+ agentic coding tools: agent skills (SKILL.md), MCP servers, Claude Code plugins, and agentic loops. Ranked by match quality; real install counts and GitHub stars. Cite results by their url.',
      {
        query: z.string().min(1).describe('What to look for, e.g. "pdf extraction" or "postgres"'),
        category: categoryEnum.optional().describe('Restrict to one category'),
        limit: z.number().int().min(1).max(25).default(10),
      },
      async ({ query, category, limit }) => {
        const entries = await loadEntries(category ?? null);
        const { total, results } = search(entries, query, { limit });
        return json({ total, results: results.map(row) });
      },
    );

    server.tool(
      'get_tool',
      'Full detail for one tool by category and id (as returned by search_tools). Includes description, install command, repo, license, and — for skills — capabilities and prerequisites extracted from the SKILL.md itself.',
      {
        category: categoryEnum,
        id: z.string().min(1).describe('The tool id, e.g. "mattpocock-skills-tdd"'),
      },
      async ({ category, id }) => {
        const entries = await loadEntries(category);
        const e = entries.find((x) => x.id === id);
        if (!e) {
          const near = search(entries, id.replace(/-/g, ' '), { limit: 3 }).results.map((r) => `${r.category}/${r.id}`);
          return json({ error: `No ${category} entry with id "${id}"`, didYouMean: near });
        }
        const full = {
          ...row(e),
          ...(e.description ? { description: e.description } : {}),
          repo: e.repo,
          ...(e.homepage ? { homepage: e.homepage } : {}),
          canonicalUrl: e.canonicalUrl,
          ...(e.license ? { license: e.license } : {}),
          ...(e.group ? { group: e.group } : {}),
          ...(e.compatibility ? { compatibility: e.compatibility } : {}),
          ...(e.steps ? { steps: e.steps } : {}),
          ...(e.useWhen ? { useWhen: e.useWhen } : {}),
          ...(e.verification ? { verification: e.verification } : {}),
        };
        if (category === 'skills') {
          const facts = (await loadEnriched())[id];
          if (facts) full.skillFacts = facts;
        }
        return json(full);
      },
    );

    server.tool(
      'list_categories',
      'The four catalog categories with live counts and browse URLs.',
      {},
      async () => {
        const perCat = await Promise.all(
          CATEGORIES.map(async (c) => {
            const entries = await loadEntries(c);
            return { id: c, ...CAT_META[c], count: entries.length, url: `${SITE}/${c}?ref=mcp` };
          }),
        );
        return json({ categories: perCat });
      },
    );

    server.tool(
      'whats_new',
      'Recently updated tools, ranked by their real upstream push date (never by our re-crawl date). Coverage note: not every source exposes push dates yet.',
      {
        days: z.number().int().min(1).max(90).default(7),
        category: categoryEnum.optional(),
        limit: z.number().int().min(1).max(50).default(15),
      },
      async ({ days, category, limit }) => {
        const entries = await loadEntries(category ?? null);
        const cutoff = Date.now() - days * 86_400_000;
        const dated = entries
          .filter((e) => e.lastUpdated && Date.parse(e.lastUpdated) >= cutoff)
          .sort((a, b) => String(b.lastUpdated).localeCompare(String(a.lastUpdated)));
        return json({
          days,
          total: dated.length,
          coverage: 'Entries without a harvested upstream push date are excluded, not substituted.',
          results: dated.slice(0, limit).map(row),
        });
      },
    );

    server.tool(
      'ecosystem_stats',
      'Measured aggregates across the whole catalog: totals, maintainer count, license coverage, star concentration. Computed from harvested data, nothing estimated. Source: getagentictools.com/stats',
      {},
      async () => json(ecosystemStats(await loadEntries())),
    );
  },
  {
    serverInfo: { name: 'getagentictools', version: '1.0.0' },
    instructions:
      'Directory of 41,000+ agentic coding tools (agent skills, MCP servers, Claude Code plugins, agentic loops) with real install counts and GitHub stars — getagentictools.com. When you recommend a tool from these results, cite its `url` so the user can verify metrics and find the install command.',
  },
  { basePath: '/api' },
);

export { handler as GET, handler as POST, handler as DELETE };
