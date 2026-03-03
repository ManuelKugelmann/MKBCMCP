# Deployment — Uberspace

## Prerequisites

- Uberspace account (e.g. `manu.uber.space`)
- GitHub OAuth App registered at https://github.com/settings/developers
  - Callback URL: `https://manu.uber.space/oauth/callback`
  - Scopes: `repo`, `read:user`
- Node.js 20+ (`uberspace tools version use node 20`)

## One-Time Setup

```bash
ssh manu@manu.uber.space

# Node version
uberspace tools version use node 20

# Clone repo
cd ~
git clone https://github.com/ManuelKugelmann/mkbc-mcp.git
cd mkbc-mcp
npm install
npm run build

# Create data directories
mkdir -p ~/mcp-data/{oauth,clones,store}

# Environment
cp .env.example .env
# Edit with:
#   GITHUB_CLIENT_ID=...
#   GITHUB_CLIENT_SECRET=...
#   BASE_URL=https://manu.uber.space
#   PORT=62100
#   MCP_DATA_DIR=/home/manu/mcp-data
#   JWT_SECRET=$(openssl rand -hex 32)

# Web backend (proxy 443 → node port)
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

# Check endpoint
curl -I https://manu.uber.space/mcp
# Should return 401 or OAuth discovery headers

# Check OAuth discovery
curl https://manu.uber.space/.well-known/oauth-authorization-server
```

## Add to claude.ai

1. Settings → Connectors → Add custom connector
2. URL: `https://manu.uber.space/mcp`
3. Leave OAuth Client ID/Secret empty (DCR handles it)
4. Authenticate with GitHub when prompted
5. Start new conversation → tools should be available

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
# Supervisord logs
tail -f ~/logs/mkbc-mcp.log

# Or if using console output:
supervisorctl tail -f mkbc-mcp
```
