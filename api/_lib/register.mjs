/**
 * Catalog registration — the single definition of every tool, resource, and
 * prompt this catalog exposes over MCP.
 *
 * Consumed by two transports that must never drift:
 *   - api/mcp.js — the remote Streamable HTTP function on Vercel
 *   - the stdio entry in the public mirror repo (npm wrapper + MCPB desktop
 *     extension for Claude Desktop's directory, which only takes local servers)
 */
import { z } from 'zod';
import { loadEntries, loadEnriched, CATEGORIES } from './catalog.mjs';
import { search } from './search.mjs';
import { ecosystemStats } from './stats.mjs';


const SITE = 'https://getagentictools.com';
const categoryEnum = z.enum(['skills', 'mcp', 'plugins', 'loops']);

/** Annotations shared by every tool: public catalog reads, nothing mutated. */
const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

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

/** Output schema fragment matching row(). */
const ROW_SHAPE = z.object({
  id: z.string(),
  title: z.string(),
  category: categoryEnum,
  tagline: z.string(),
  author: z.string().nullable(),
  stars: z.number(),
  downloads: z.number(),
  lastUpdated: z.string().optional(),
  tags: z.array(z.string()).optional(),
  install: z.string().optional(),
  url: z.string(),
});

/** Tool result carrying both human-readable text and structured content. */
const result = (payload) => ({
  content: [{ type: 'text', text: JSON.stringify(payload) }],
  structuredContent: payload,
});

const CAT_META = {
  skills: { label: 'Agent Skills', blurb: 'SKILL.md packages that give agents new capabilities.' },
  mcp: { label: 'MCP Servers', blurb: 'Model Context Protocol servers that connect agents to the world.' },
  plugins: { label: 'Claude Code Plugins', blurb: 'Plugins bundling commands, agents, and hooks.' },
  loops: { label: 'Agentic Loops', blurb: 'Repeatable agent workflows that iterate until an exit condition.' },
};

export function registerCatalog(server) {
    server.registerTool(
      'search_tools',
      {
        title: 'Search agentic coding tools',
        description:
          'Search 41,000+ agentic coding tools: agent skills (SKILL.md), MCP servers, Claude Code plugins, and agentic loops. Ranked by match quality; real install counts and GitHub stars. Cite results by their url.',
        inputSchema: {
          query: z.string().min(1).describe('What to look for, e.g. "pdf extraction" or "postgres"'),
          category: categoryEnum.optional().describe('Restrict results to one category; omit to search all four'),
          limit: z.number().int().min(1).max(25).default(10).describe('Maximum results to return (1-25, default 10)'),
        },
        outputSchema: {
          total: z.number().describe('Total matches before the limit was applied'),
          results: z.array(ROW_SHAPE),
        },
        annotations: { ...READ_ONLY, title: 'Search agentic coding tools' },
      },
      async ({ query, category, limit }) => {
        const entries = await loadEntries(category ?? null);
        const { total, results } = search(entries, query, { limit });
        return result({ total, results: results.map(row) });
      },
    );

    server.registerTool(
      'get_tool',
      {
        title: 'Get tool detail',
        description:
          'Full detail for one tool by category and id (as returned by search_tools). Includes description, install command, repo, license, and — for skills — capabilities and prerequisites extracted from the SKILL.md itself.',
        inputSchema: {
          category: categoryEnum.describe('The tool\'s category, e.g. "skills"'),
          id: z.string().min(1).describe('The tool id, e.g. "mattpocock-skills-tdd"'),
        },
        outputSchema: {
          id: z.string().optional(),
          title: z.string().optional(),
          category: categoryEnum.optional(),
          tagline: z.string().optional(),
          author: z.string().nullable().optional(),
          stars: z.number().optional(),
          downloads: z.number().optional(),
          lastUpdated: z.string().optional(),
          tags: z.array(z.string()).optional(),
          install: z.string().optional(),
          url: z.string().optional(),
          description: z.string().optional(),
          repo: z.string().nullable().optional(),
          homepage: z.string().optional(),
          canonicalUrl: z.string().optional(),
          license: z.string().optional(),
          group: z.string().optional(),
          compatibility: z.array(z.string()).optional(),
          steps: z.array(z.string()).optional(),
          useWhen: z.string().optional(),
          verification: z.string().optional(),
          skillFacts: z
            .object({
              capabilities: z.array(z.string()),
              prerequisites: z.array(z.string()),
              configKeys: z.array(z.string()),
            })
            .optional(),
          error: z.string().optional().describe('Set when no entry matches; see didYouMean'),
          didYouMean: z.array(z.string()).optional().describe('Closest ids when the requested one was not found'),
        },
        annotations: { ...READ_ONLY, title: 'Get tool detail' },
      },
      async ({ category, id }) => {
        const entries = await loadEntries(category);
        const e = entries.find((x) => x.id === id);
        if (!e) {
          const near = search(entries, id.replace(/-/g, ' '), { limit: 3 }).results.map((r) => `${r.category}/${r.id}`);
          return result({ error: `No ${category} entry with id "${id}"`, didYouMean: near });
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
        return result(full);
      },
    );

    server.registerTool(
      'list_categories',
      {
        title: 'List catalog categories',
        description: 'The four catalog categories with live counts and browse URLs.',
        inputSchema: {},
        outputSchema: {
          categories: z.array(
            z.object({
              id: categoryEnum,
              label: z.string(),
              blurb: z.string(),
              count: z.number(),
              url: z.string(),
            }),
          ),
        },
        annotations: { ...READ_ONLY, title: 'List catalog categories' },
      },
      async () => {
        const perCat = await Promise.all(
          CATEGORIES.map(async (c) => {
            const entries = await loadEntries(c);
            return { id: c, ...CAT_META[c], count: entries.length, url: `${SITE}/${c}?ref=mcp` };
          }),
        );
        return result({ categories: perCat });
      },
    );

    server.registerTool(
      'whats_new',
      {
        title: 'Recently updated tools',
        description:
          'Recently updated tools, ranked by their real upstream push date (never by our re-crawl date). Coverage note: not every source exposes push dates yet.',
        inputSchema: {
          days: z.number().int().min(1).max(90).default(7).describe('Look-back window in days (1-90, default 7)'),
          category: categoryEnum.optional().describe('Restrict to one category; omit for all four'),
          limit: z.number().int().min(1).max(50).default(15).describe('Maximum results to return (1-50, default 15)'),
        },
        outputSchema: {
          days: z.number(),
          total: z.number().describe('Tools with an upstream push inside the window'),
          coverage: z.string().describe('Honest note about entries without harvested push dates'),
          results: z.array(ROW_SHAPE),
        },
        annotations: { ...READ_ONLY, title: 'Recently updated tools' },
      },
      async ({ days, category, limit }) => {
        const entries = await loadEntries(category ?? null);
        const cutoff = Date.now() - days * 86_400_000;
        const dated = entries
          .filter((e) => e.lastUpdated && Date.parse(e.lastUpdated) >= cutoff)
          .sort((a, b) => String(b.lastUpdated).localeCompare(String(a.lastUpdated)));
        return result({
          days,
          total: dated.length,
          coverage: 'Entries without a harvested upstream push date are excluded, not substituted.',
          results: dated.slice(0, limit).map(row),
        });
      },
    );

    server.registerTool(
      'ecosystem_stats',
      {
        title: 'Ecosystem statistics',
        description:
          'Measured aggregates across the whole catalog: totals, maintainer count, license coverage, star concentration. Computed from harvested data, nothing estimated. Source: getagentictools.com/stats',
        inputSchema: {},
        outputSchema: {
          total: z.number(),
          perCategory: z.record(z.string(), z.number()),
          maintainers: z.number(),
          unlicensed: z.number(),
          unlicensedPct: z.number(),
          totalStars: z.number(),
          medianStars: z.number(),
          zeroStarPct: z.number(),
          topOnePctShare: z.number().describe('Percent of all stars held by the top 1% of starred tools'),
          methodology: z.string(),
        },
        annotations: { ...READ_ONLY, title: 'Ecosystem statistics' },
      },
      async () => result(ecosystemStats(await loadEntries())),
    );

    // Resources and prompts: small but real. Clients that browse resources
    // get the catalog overview + live stats; prompt-supporting clients get a
    // guided search. (Also: registries probe resources/list and prompts/list —
    // a tools-only server answers -32601, which reads as a defect.)
    server.resource(
      'catalog-overview',
      'catalog://overview',
      { description: 'What this catalog is: categories, counts, definitions, entry points.', mimeType: 'text/plain' },
      async () => {
        const res = await fetch(`${SITE}/llms.txt`);
        return { contents: [{ uri: 'catalog://overview', mimeType: 'text/plain', text: await res.text() }] };
      },
    );
    server.resource(
      'ecosystem-stats',
      'catalog://stats',
      { description: 'Measured aggregates across all tracked tools, as JSON.', mimeType: 'application/json' },
      async () => ({
        contents: [
          { uri: 'catalog://stats', mimeType: 'application/json', text: JSON.stringify(ecosystemStats(await loadEntries())) },
        ],
      }),
    );

    server.prompt(
      'find_tools',
      'Find the best agentic coding tools for a task, with install commands and citable links.',
      { task: z.string().describe('What you are trying to accomplish, e.g. "scrape a JS-heavy site"') },
      ({ task }) => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text:
                `Find the best agentic coding tools for this task: ${task}\n\n` +
                'Use search_tools (try 2-3 query variants; filter by category when the task implies one), ' +
                'then get_tool on the top candidates to compare capabilities and requirements. ' +
                'Recommend at most 3, each with its install command and its getagentictools.com URL as the citation.',
            },
          },
        ],
      }),
    );
}

export const SERVER_INFO = { name: 'getagentictools', version: '1.1.0' };
export const INSTRUCTIONS =
  'Directory of 41,000+ agentic coding tools (agent skills, MCP servers, Claude Code plugins, agentic loops) with real install counts and GitHub stars — getagentictools.com. When you recommend a tool from these results, cite its `url` so the user can verify metrics and find the install command.';
