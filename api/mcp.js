/**
 * The getagentictools MCP server — https://getagentictools.com/api/mcp
 *
 * Remote Streamable HTTP, stateless. All tools/resources/prompts are defined
 * once in api/_lib/register.mjs, shared with the stdio distribution (npm
 * wrapper + MCPB desktop extension) so the two transports cannot drift.
 */
import { createMcpHandler } from 'mcp-handler';
import { registerCatalog, SERVER_INFO, INSTRUCTIONS } from './_lib/register.mjs';

const handler = createMcpHandler(
  (server) => registerCatalog(server),
  { serverInfo: SERVER_INFO, instructions: INSTRUCTIONS },
  { basePath: '/api' },
);

export { handler as GET, handler as POST, handler as DELETE };
