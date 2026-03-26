import { Octokit } from "octokit";
import { getAuthSession } from "fastmcp";

/**
 * Create a session-scoped Octokit instance using the upstream GitHub token
 * from the FastMCP OAuth proxy session.
 */
export function createOctokit(session: Record<string, unknown> | undefined): Octokit {
  const { accessToken } = getAuthSession(session);
  return new Octokit({ auth: accessToken });
}
