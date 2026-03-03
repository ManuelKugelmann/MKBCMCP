/**
 * Session data from FastMCP OAuth proxy.
 * The exact shape depends on FastMCP version and OAuth provider.
 */
export interface McpSession {
  /** JWT claims from FastMCP-issued token */
  sub?: string;
  /** Upstream GitHub access token (stored server-side with token swap) */
  upstreamAccessToken?: string;
  /** GitHub user info */
  user?: {
    login: string;
    id: number;
    name?: string;
    email?: string;
  };
}

/**
 * Configuration loaded from environment.
 */
export interface Config {
  githubClientId: string;
  githubClientSecret: string;
  baseUrl: string;
  port: number;
  dataDir: string;
  jwtSecret: string;
}

export function loadConfig(): Config {
  const required = (key: string): string => {
    const val = process.env[key];
    if (!val) throw new Error(`Missing required env var: ${key}`);
    return val;
  };

  return {
    githubClientId: required("GITHUB_CLIENT_ID"),
    githubClientSecret: required("GITHUB_CLIENT_SECRET"),
    baseUrl: required("BASE_URL"),
    port: parseInt(process.env.PORT || "62100", 10),
    dataDir: process.env.MCP_DATA_DIR || "./mcp-data",
    jwtSecret: required("JWT_SECRET"),
  };
}
