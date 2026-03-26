# mkbc-mcp

Custom MCP server extending the official GitHub MCP with tools for project
bootstrapping, regex grep, and local file storage. Bridges claude.ai chat
conversations to Claude Code via structured CLAUDE.md handoff.

## Quick Install

```bash
curl -fsSL https://raw.githubusercontent.com/ManuelKugelmann/MKBCMCP/main/install.sh | bash
```

Requires Node.js 20+ and git. Prompts for GitHub OAuth credentials interactively.
See [install.sh](install.sh) for details.

## What This Does

The official [GitHub MCP](https://api.githubcopilot.com/mcp/) handles repos, issues,
PRs, code search, and file operations. This server fills the gaps:

| Tool | What it does | Why not official MCP |
|------|-------------|---------------------|
| `gh_project_bootstrap` | Create repo with structured CLAUDE.md from chat context | Templated scaffolding for chat→code handoff |
| `gh_project_add_context` | Append content to CLAUDE.md sections | Structured section-aware editing |
| `gh_grep` | PCRE regex search across repos via shallow clone cache | GitHub Search API has no regex |
| `store_write` | Save file to local server storage | Local filesystem, not GitHub |
| `store_read` | Read file from local server storage | Local filesystem, not GitHub |
| `store_list` | List files in local project store | Local filesystem, not GitHub |
| `store_delete` | Delete file from local project store | Local filesystem, not GitHub |

## Architecture

```
Claude.ai / Claude Desktop / Claude Code CLI
    │
    │  OAuth 2.1 (GitHub via FastMCP proxy)
    ▼
FastMCP Server (TypeScript, port 62100)
    │
    ├── gh_project_bootstrap ──→ GitHub API (Git Data API, atomic commits)
    ├── gh_project_add_context ─→ GitHub API (Contents API)
    ├── gh_grep ───────────────→ local shallow clone + git grep
    └── store_* ───────────────→ local filesystem ($MCP_DATA_DIR/store/)
```

- **OAuth**: GitHub token stays server-side (encrypted). Clients only get FastMCP JWTs.
- **No database**: flat files only (DiskStore for tokens, filesystem for store).
- **Hybrid strategy**: this server + official GitHub MCP = full coverage.

## Setup

### Prerequisites

- Node.js 20+
- GitHub OAuth App ([create one](https://github.com/settings/developers))
  - Callback URL: `https://claude.ai/api/mcp/auth_callback` (for Claude.ai)

### Manual Install

```bash
git clone https://github.com/ManuelKugelmann/MKBCMCP.git
cd MKBCMCP
npm install
npm run build

cp .env.example .env
# Edit .env with your GitHub OAuth credentials and BASE_URL

node --env-file=.env dist/server.js
```

### Connect Claude.ai

1. Settings → Connectors → **Add custom connector**
2. URL: `https://your-host/mcp`
3. Expand **Advanced settings**
4. Paste your GitHub OAuth App **Client ID** and **Client Secret**
5. Authenticate with GitHub when prompted

> **Note:** DCR does not work reliably with Claude.ai. You must provide static
> credentials via Advanced settings. See [docs/oauth.md](docs/oauth.md) for details.

Add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "mkbc-mcp": {
      "url": "https://your-host/mcp"
    }
  }
}
```

### Connect Claude Code CLI

```bash
claude mcp add mkbc-mcp --transport http https://your-host/mcp
```

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GITHUB_CLIENT_ID` | yes | — | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | yes | — | GitHub OAuth App client secret |
| `BASE_URL` | yes | — | Public URL (e.g. `https://host.uber.space`) |
| `PORT` | no | `62100` | Server port |
| `MCP_DATA_DIR` | no | `./mcp-data` | Data directory (tokens, clones, store) |

## Deployment (Uberspace)

See [docs/deployment.md](docs/deployment.md) for full Uberspace setup with
supervisord, web backend routing, and TLS.

## Project Structure

```
src/
  server.ts           # FastMCP entry point + OAuth config
  types.ts            # Config interface
  lib/
    octokit.ts        # Session-scoped GitHub API client
    templates.ts      # CLAUDE.md, README, .gitignore renderers
  tools/
    bootstrap.ts      # gh_project_bootstrap, gh_project_add_context
    grep.ts           # gh_grep (shallow clone + git grep)
    store.ts          # store_write, store_read, store_list, store_delete
deploy/
  supervisord.ini     # Process manager config
  setup.sh            # Uberspace setup script
docs/
  oauth.md            # OAuth + FastMCP authentication reference
  tools.md            # Tool design specifications
  decisions.md        # Architecture Decision Records (ADR-001 to ADR-006)
  deployment.md       # Uberspace deployment guide
```

## Documentation

- [OAuth & Authentication](docs/oauth.md) — how the OAuth proxy works, token flow, security model
- [Tool Design](docs/tools.md) — parameters and implementation details for all 7 tools
- [Architecture Decisions](docs/decisions.md) — ADR-001 through ADR-006
- [Deployment Guide](docs/deployment.md) — Uberspace setup, supervisord, verification
- [GitHub MCP Comparison](docs/github-mcp-comparison.md) — official vs custom MCP tools

## Tech Stack

- **TypeScript + Node.js 20+** — server runtime
- **FastMCP** (npm, punkpeye) — MCP server framework with OAuth proxy
- **Octokit** — GitHub API client (repos, Git Data API)
- **Zod** — tool parameter validation
- **Uberspace** — deployment target (shared hosting)
- **supervisord** — process management

## License

Private / personal use.
