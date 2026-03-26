# Deployment — Uberspace

## Prerequisites

- Uberspace account (e.g. `manu.uber.space`)
- GitHub OAuth App registered at https://github.com/settings/developers
  - Callback URL: `https://claude.ai/api/mcp/auth_callback`
  - No special scopes needed in the app config (server requests `repo` at runtime)
- Node.js 20+ (`uberspace tools version use node 20`)

## One-Line Install

```bash
ssh manu@manu.uber.space
curl -fsSL https://raw.githubusercontent.com/ManuelKugelmann/MKBCMCP/main/install.sh | bash
```

The script handles everything: clone, build, data dirs, `.env` creation, supervisord,
and web backend routing. It prompts for GitHub OAuth credentials interactively.

## Manual Setup

```bash
ssh manu@manu.uber.space

# Node version
uberspace tools version use node 20

# Clone repo
cd ~
git clone https://github.com/ManuelKugelmann/MKBCMCP.git mkbc-mcp
cd mkbc-mcp
npm install
npm run build

# Create data directories
mkdir -p ~/mcp-data/{oauth,clones,store}
mkdir -p ~/logs

# Environment
cp .env.example .env
# Edit .env:
#   GITHUB_CLIENT_ID=...
#   GITHUB_CLIENT_SECRET=...
#   BASE_URL=https://manu.uber.space
#   PORT=62100
#   MCP_DATA_DIR=/home/manu/mcp-data

# Web backend (proxy 443 -> node port)
uberspace web backend set / --http --port 62100

# Supervisord service
cp deploy/supervisord.ini ~/etc/services.d/mkbc-mcp.ini
supervisorctl reread
supervisorctl update
supervisorctl start mkbc-mcp
```

## Verify

```bash
# Check process
supervisorctl status mkbc-mcp

# Check endpoint (should return 401 or 405)
curl -s -o /dev/null -w "%{http_code}" https://manu.uber.space/mcp

# Check OAuth discovery
curl -s https://manu.uber.space/.well-known/oauth-protected-resource
```

## Add to Claude.ai

1. Settings → Connectors → **Add custom connector**
2. URL: `https://manu.uber.space/mcp`
3. Expand **Advanced settings**
4. Paste your GitHub OAuth App **Client ID** and **Client Secret**
5. Authenticate with GitHub when prompted
6. Start new conversation — tools should be available

## Update

```bash
ssh manu@manu.uber.space
cd ~/mkbc-mcp
git pull
npm install
npm run build
supervisorctl restart mkbc-mcp
```

## Logs

```bash
tail -f ~/logs/mkbc-mcp.out.log
tail -f ~/logs/mkbc-mcp.err.log
```
