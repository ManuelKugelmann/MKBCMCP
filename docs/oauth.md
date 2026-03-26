# OAuth & FastMCP Authentication

## Overview

mkbc-mcp uses **TypeScript FastMCP** (punkpeye, npm `fastmcp@^3.33`) for OAuth.
FastMCP's `GitHubProvider` acts as an OAuth proxy: it presents a DCR-compliant
interface to MCP clients while using your pre-registered GitHub OAuth App credentials
with GitHub as the upstream provider.

All 7 tools require authentication via `canAccess: requireAuth`.

## How It Works

```
MCP Client (Claude.ai / Desktop / CLI)
    |
    |  1. GET /.well-known/oauth-protected-resource  →  discovers OAuth endpoints
    |  2. POST /register  (DCR)  →  gets back your GitHub OAuth App credentials
    |  3. GET /authorize  →  redirects to GitHub login
    |  4. GitHub callback → POST /auth/callback  →  FastMCP exchanges code for token
    |  5. FastMCP mints its own JWT, returns to client's callback
    |  6. Client uses JWT as Bearer token for all subsequent MCP requests
    v
FastMCP Server (localhost:62100)
    |
    |  JWT verified → upstream GitHub token retrieved from DiskStore
    |  Passed to tools via session → getAuthSession(session).accessToken
    v
GitHub API (via Octokit)
```

### Token Architecture

- **Client never sees the GitHub token.** FastMCP issues its own JWTs.
- Upstream GitHub tokens are encrypted (Fernet AES-128-CBC + HMAC-SHA256) and
  stored in `$MCP_DATA_DIR/oauth/` via `DiskStore`.
- JWTs are signed with HS256. The signing key is derived from the GitHub client
  secret via HKDF (no separate `JWT_SECRET` env var needed).

### DCR (Dynamic Client Registration)

FastMCP implements DCR at `/register`. In theory, MCP clients POST to `/register`
with their callback URL and get back the `client_id` to drive OAuth automatically.

**In practice, DCR does not work reliably with Claude.ai.** Claude.ai's DCR
implementation has known issues that cause the OAuth flow to fail silently or loop.

### Static Credentials (Known Working Path)

The reliable approach is to **bypass DCR entirely** using Claude.ai's Advanced
settings:

1. Pre-register `https://claude.ai/api/mcp/auth_callback` as an authorized
   callback URL in your GitHub OAuth App
2. Give users the `client_id` and `client_secret` to paste into the connector
3. Claude.ai uses these directly — no DCR round-trip needed

See [Connecting Claude.ai](#connecting-claudeai) below for step-by-step instructions.

## GitHub OAuth App Setup

1. Go to https://github.com/settings/developers → **New OAuth App**
2. Fill in:
   - **Application name:** `mkbc-mcp`
   - **Homepage URL:** `https://your-host.uber.space`
   - **Authorization callback URL:** `https://claude.ai/api/mcp/auth_callback`
3. Copy **Client ID** and generate a **Client Secret**
4. Add both to `.env`

> The callback URL points to **Claude.ai** (`https://claude.ai/api/mcp/auth_callback`),
> not to your server. Claude.ai handles the final OAuth redirect, then passes the
> token upstream to FastMCP.

### Multiple Callback URLs

GitHub OAuth Apps support only **one** callback URL. If you also need server-side
callbacks (e.g. for Claude Desktop or CLI), register a second OAuth App with
callback URL `https://your-host.uber.space/auth/callback`.

## Connecting Claude.ai

1. Settings → Connectors → **Add custom connector**
2. URL: `https://your-host.uber.space/mcp`
3. Expand **Advanced settings**
4. Paste your GitHub OAuth App **Client ID** and **Client Secret**
5. Authenticate with GitHub when prompted
6. Start new conversation — tools should be available

## OAuth Scopes

Only one scope is requested:

| Scope | Why |
|-------|-----|
| `repo` | Bootstrap creates repos, grep clones private repos |

`read:user` is **not needed** — the GitHub token from the OAuth flow already grants
user identity via `GET /user`. Requesting fewer scopes is more secure.

## Tool Authentication

Every tool uses `canAccess: requireAuth` which rejects unauthenticated requests
before the execute function runs. Inside tools, the GitHub token is accessed via:

```typescript
import { getAuthSession } from "fastmcp";

// In tool execute function:
const { accessToken } = getAuthSession(session);
const octokit = new Octokit({ auth: accessToken });
```

## Security Model

| Layer | Mechanism |
|-------|-----------|
| Authentication | GitHub OAuth 2.1 via FastMCP GitHubProvider (static credentials, not DCR) |
| Token isolation | FastMCP issues JWTs; upstream GitHub tokens encrypted on disk |
| Authorization | `canAccess: requireAuth` on all tools |
| Transport | HTTPS only (Uberspace auto-TLS via Let's Encrypt) |
| Storage | DiskStore with Fernet encryption for token persistence |

### Known Limitations

- **No user allowlist** — any GitHub user who completes OAuth can use the tools.
  For a single-user server behind an unlisted URL, this is acceptable. For stricter
  access, a custom `canAccess` function checking the GitHub username is needed.
- **Single-user only** — DiskStore doesn't distinguish between users. FastMCP's
  in-memory state is also single-process.

## TypeScript vs Python FastMCP

Two different `fastmcp` packages exist. This project uses the **TypeScript** one:

| | TypeScript (npm) | Python (PyPI) |
|---|---|---|
| Author | punkpeye | jlowin (Prefect) |
| Package | `fastmcp` on npm | `fastmcp` on PyPI |
| Used by | **mkbc-mcp** (this project) | CLAUDEUSMCP (separate gateway) |
| OAuth | `GitHubProvider` from `"fastmcp"` | `GitHubProvider` from `fastmcp.server.auth.providers.github` |
| Token store | `DiskStore` from `"fastmcp/auth"` | In-memory (Redis via plugins) |
| DCR with Claude.ai | Broken (use static credentials) | Broken (use static credentials) |
| Known issues | Stable otherwise | 5-min timeout, secret exposure |

## Environment Variables

```bash
# Required
GITHUB_CLIENT_ID=Ov23li...          # From GitHub OAuth App
GITHUB_CLIENT_SECRET=abc123...       # From GitHub OAuth App
BASE_URL=https://your-host.uber.space  # Public URL (used in DCR + JWT issuer)

# Optional
PORT=62100                           # Default: 62100
MCP_DATA_DIR=./mcp-data              # Default: ./mcp-data (stores tokens in /oauth)
```

## Troubleshooting

### OAuth flow fails / redirect error
- **Claude.ai:** Verify callback URL in GitHub OAuth App is **exactly**
  `https://claude.ai/api/mcp/auth_callback` and that you pasted Client ID + Secret
  in the connector's Advanced settings (DCR does not work)
- **Other clients:** Verify callback URL matches `https://your-host/auth/callback`
- Check `BASE_URL` env var matches the public URL
- Test discovery: `curl -s https://your-host/.well-known/oauth-protected-resource`

### "Not authenticated" errors on tools
- Token may have expired — re-authenticate via the client
- Check DiskStore directory exists and is writable: `ls -la $MCP_DATA_DIR/oauth/`

### Token not passed to tools
- Ensure all tools have `canAccess: requireAuth`
- Use `getAuthSession(session)` (not `session.accessToken` directly)

## References

- [FastMCP (TypeScript) docs](https://gofastmcp.com)
- [FastMCP OAuth Proxy docs](https://gofastmcp.com/servers/auth/oauth-proxy)
- [GitHub OAuth Apps](https://docs.github.com/en/apps/oauth-apps)
- [MCP Authorization spec](https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization)
