# mkbc-mcp

> Custom MCP server extending the official GitHub MCP with tools for project bootstrapping, regex grep, and local file storage. Bridges claude.ai chat conversations to Claude Code via structured CLAUDE.md handoff.

## Project Context

Personal MCP (Model Context Protocol) server filling gaps in the official GitHub MCP Connector. Runs on Uberspace shared hosting:

1. **Project Bootstrap** — Create GitHub repos with structured CLAUDE.md from chat context
2. **Regex Grep** — PCRE grep across repos via shallow clone cache (GitHub Search API has no regex)
3. **Local Store** — Filesystem read/write for project artifacts on the server

Hybrid strategy (ADR-001): this server only implements tools the official GitHub MCP doesn't provide.

## Tech Stack

- TypeScript + Node.js 20+
- FastMCP v3 (npm, punkpeye — MCP server framework with OAuth proxy)
- Octokit v5 (GitHub API client)
- Zod (parameter validation)
- Uberspace (deployment target)
- supervisord (process management)

## Project Structure

```
src/
  server.ts              # FastMCP server entry point + OAuth config
  types.ts               # Config interface
  lib/
    octokit.ts           # Session-scoped Octokit factory (getAuthSession)
    templates.ts         # CLAUDE.md, README, .gitignore renderers
  tools/
    bootstrap.ts         # gh_project_bootstrap, gh_project_add_context
    grep.ts              # gh_grep (shallow clone + git grep)
    store.ts             # store_write, store_read, store_list, store_delete
deploy/
  supervisord.ini        # Process manager config
  setup.sh               # Uberspace setup script
docs/
  oauth.md               # OAuth + FastMCP authentication reference
  tools.md               # Tool design specifications
  decisions.md           # Architecture Decision Records (ADR-001 to ADR-006)
  deployment.md          # Uberspace deployment guide
  github-mcp-comparison.md  # Official vs custom MCP comparison
  claude-md-template.md  # CLAUDE.md section reference
install.sh               # One-line install script
.env.example             # Environment variable template
```

## Build & Run

```bash
npm install
npm run build
node --env-file=.env dist/server.js
```

Required env vars: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `BASE_URL`
Optional: `PORT` (default 62100), `MCP_DATA_DIR` (default ./mcp-data)

## Authentication

All tools require OAuth via `canAccess: requireAuth`. FastMCP's `GitHubProvider` handles the OAuth proxy flow with DCR. GitHub tokens stay server-side (encrypted via DiskStore). Clients only get FastMCP JWTs. See [docs/oauth.md](docs/oauth.md).

## Constraints

- No database — flat files only (ADR-005)
- Single-user personal server
- Official GitHub MCP handles standard repo/issue/PR operations
- OAuth uses GitHub provider only, not generic (ADR-002)
- OAuth scope: `repo` only (no `read:user`)

## Decisions

See [docs/decisions.md](docs/decisions.md) for full ADRs.

## References

- FastMCP (TypeScript): https://gofastmcp.com
- MCP spec: https://modelcontextprotocol.io
- GitHub MCP: https://api.githubcopilot.com/mcp/
- Uberspace: https://uberspace.de
