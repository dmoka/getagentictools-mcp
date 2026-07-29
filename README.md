# getagentictools MCP server

Search **41,000+ agent skills, MCP servers, Claude Code plugins, and agentic loops** from inside any MCP-capable agent. This is the remote MCP server for [getagentictools.com](https://getagentictools.com?ref=github-mcp) — real install counts and GitHub stars, refreshed weekly, never faked.

**Endpoint:** `https://getagentictools.com/api/mcp` — Streamable HTTP, free, no auth, no tracking.

## Connect your client

### Claude Code

```bash
claude mcp add --transport http getagentictools https://getagentictools.com/api/mcp
```

### Cursor

```json
// .cursor/mcp.json
{
  "mcpServers": {
    "getagentictools": { "url": "https://getagentictools.com/api/mcp" }
  }
}
```

### VS Code (Copilot)

```json
// .vscode/mcp.json
{
  "servers": {
    "getagentictools": { "type": "http", "url": "https://getagentictools.com/api/mcp" }
  }
}
```

### OpenAI Codex

```toml
# ~/.codex/config.toml
[mcp_servers.getagentictools]
url = "https://getagentictools.com/api/mcp"
```

### Gemini CLI

```json
// ~/.gemini/settings.json
{
  "mcpServers": {
    "getagentictools": { "httpUrl": "https://getagentictools.com/api/mcp" }
  }
}
```

Then ask your agent things like *“find me an MCP server for Postgres”* or *“what skills exist for PDF extraction?”* — results carry install commands and links to their catalog pages.

## Tools

| Tool | What it does |
|---|---|
| `search_tools` | Ranked search across all four categories. Query, optional category filter; install command and page URL on every hit |
| `get_tool` | Full detail for one tool — description, repo, license, install command, plus SKILL.md-extracted capabilities for enriched skills |
| `list_categories` | The four categories with live counts |
| `whats_new` | Recently updated tools, by real upstream push date |
| `ecosystem_stats` | Measured aggregates: maintainer count, license coverage, star concentration |

## How it works

- **Deterministic.** No LLM sits between your agent and the data — tokenized field-weighted scoring, popularity as a tiebreak only.
- **Fresh by construction.** The server reads the same dataset the website serves, generated in the same deploy, so it cannot drift from what you see on [getagentictools.com](https://getagentictools.com?ref=github-mcp). The catalog is re-harvested weekly from GitHub and public registries.
- **Free and unauthenticated.** Public data, read-only, no accounts, no tracking beyond standard web logs.

## About this repo

This repo mirrors the deployed server source (`api/`), which lives in a private monorepo alongside the site and data pipeline. **PRs are welcome — we port accepted changes upstream**; direct pushes here are overwritten by the next sync.

The data endpoints it reads (`/data/agent/*.json`) are public — you can build your own tooling against them. Attribution appreciated.

## License

MIT © [Daniel Moka](https://getagentictools.com)
