import { FastMCP, GitHubProvider } from "fastmcp";
import { DiskStore } from "fastmcp/auth";
import { registerBootstrapTools } from "./tools/bootstrap.js";
import { registerGrepTool } from "./tools/grep.js";
import { registerStoreTools } from "./tools/store.js";

const PORT = parseInt(process.env.PORT || "62100", 10);
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const DATA_DIR = process.env.MCP_DATA_DIR || "./mcp-data";

// OAuth proxy with GitHub as upstream provider
const auth = new GitHubProvider({
  baseUrl: BASE_URL,
  clientId: process.env.GITHUB_CLIENT_ID!,
  clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  scopes: ["repo", "read:user"],
  tokenStorage: new DiskStore({
    directory: `${DATA_DIR}/oauth`,
  }),
});

const server = new FastMCP({
  name: "mkbc-mcp",
  version: "0.2.0",
  auth,
});

// Register tool groups
registerBootstrapTools(server);
registerGrepTool(server, DATA_DIR);
registerStoreTools(server, DATA_DIR);

// Start server
await server.start({
  transportType: "httpStream",
  httpStream: { port: PORT },
});

console.log(`mkbc-mcp listening on ${BASE_URL}/mcp`);
