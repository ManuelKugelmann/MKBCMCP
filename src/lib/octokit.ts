import { Octokit } from "octokit";

/**
 * Create a session-scoped Octokit instance using the upstream GitHub token
 * from the OAuth proxy session.
 *
 * TODO: The exact API for extracting the upstream token from FastMCP's
 * OAuthProxy session depends on the version. With token swap enabled,
 * the upstream token is stored server-side and accessible via session.
 *
 * See: https://gofastmcp.com/servers/auth/oauth-proxy
 */
export function createOctokit(session: any): Octokit {
  // FastMCP's OAuthProxy with token swap stores upstream tokens
  // and makes them available via the session context.
  // The exact accessor may need adjustment based on FastMCP version.
  const token = session?.upstreamAccessToken ?? session?.accessToken;

  if (!token) {
    throw new Error("No GitHub token available in session. Is OAuth configured?");
  }

  return new Octokit({ auth: token });
}
