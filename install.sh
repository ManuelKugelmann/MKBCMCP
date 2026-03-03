#!/bin/bash
set -euo pipefail

# mkbc-mcp installer
# Usage: curl -fsSL https://raw.githubusercontent.com/ManuelKugelmann/MKBCMCP/main/install.sh | bash

REPO="https://github.com/ManuelKugelmann/MKBCMCP.git"
INSTALL_DIR="${MKBCMCP_DIR:-$HOME/mkbc-mcp}"
PORT="${PORT:-62100}"

log() { echo -e "\033[0;36m>\033[0m $*"; }
ok()  { echo -e "\033[0;32mok\033[0m $*"; }
die() { echo -e "\033[0;31merror\033[0m $*" >&2; exit 1; }

# Preflight
command -v node >/dev/null || die "Node.js 20+ required. Install: https://nodejs.org"
command -v npm >/dev/null || die "npm required"
command -v git >/dev/null || die "git required"

NODE_MAJOR=$(node -v | cut -d. -f1 | tr -d v)
[[ "$NODE_MAJOR" -ge 20 ]] || die "Node.js 20+ required (found $(node -v))"

# Clone or update
if [ -d "$INSTALL_DIR/.git" ]; then
  log "Updating existing install..."
  git -C "$INSTALL_DIR" pull --ff-only
else
  log "Cloning mkbc-mcp..."
  git clone "$REPO" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# Install and build
log "Installing dependencies..."
npm ci --ignore-scripts 2>/dev/null || npm install
log "Building..."
npm run build
ok "Build successful"

# Data directories
mkdir -p "${MCP_DATA_DIR:-./mcp-data}"/{oauth,clones,store}

# .env setup
if [ ! -f .env ]; then
  log "Creating .env from template..."
  cp .env.example .env

  echo ""
  echo "Configure your .env file:"
  echo ""
  echo "  1. Create a GitHub OAuth App: https://github.com/settings/developers"
  echo "     Callback URL: https://YOUR_HOST/oauth/callback"
  echo ""
  echo "  2. Fill in $INSTALL_DIR/.env:"
  echo "     GITHUB_CLIENT_ID=..."
  echo "     GITHUB_CLIENT_SECRET=..."
  echo "     BASE_URL=https://your-host.example.com"
  echo "     JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || echo 'generate_a_random_secret')"
  echo ""
  echo "  3. Start the server:"
  echo "     cd $INSTALL_DIR && npm start"
  echo ""
  echo "  4. Add to claude.ai:"
  echo "     Settings -> Connectors -> Add custom connector"
  echo "     URL: https://YOUR_HOST/mcp"
  echo ""
else
  ok ".env already exists"
  echo ""
  echo "Start with: cd $INSTALL_DIR && npm start"
  echo ""
fi
