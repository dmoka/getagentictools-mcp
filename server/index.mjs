#!/usr/bin/env node
/**
 * getagentictools — local stdio MCP server.
 *
 * The same catalog, tools, resources, and prompt as the remote server at
 * https://getagentictools.com/api/mcp (both consume api/_lib/register.mjs, so
 * they cannot drift). This entry exists for distributions that require a local
 * process: the MCPB desktop extension for Claude Desktop, and `npx` usage.
 * Data still comes from the public CDN endpoints; nothing runs server-side.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerCatalog, SERVER_INFO, INSTRUCTIONS } from '../api/_lib/register.mjs';

const server = new McpServer(SERVER_INFO, { instructions: INSTRUCTIONS });
registerCatalog(server);
await server.connect(new StdioServerTransport());
