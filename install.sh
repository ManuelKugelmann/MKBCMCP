#!/bin/bash
set -euo pipefail

# mkbc-mcp installer
# Usage: curl -fsSL https://raw.githubusercontent.com/ManuelKugelmann/MKBCMCP/main/install.sh | bash
#
# Environment variables (set before running, or configure in .env after):
#   MKBC_DIR          - install directory (default: ~/mkbc-mcp)
#   GITHUB_CLIENT_ID  - GitHub OAuth App client ID
#   GITHUB_CLIENT_SECRET - GitHub OAuth App client secret
#   BASE_URL          - public URL of the server (e.g. https://manu.uber.space)
#   JWT_SECRET        - random secret for JWT signing

REPO="ManuelKugelmann/MKBCMCP"
INSTALL_DIR="${MKBC_DIR:-$HOME/mkbc-mcp}"
BRANCH="${MKBC_BRANCH:-main}"

info()  { echo "==> $*"; }
error() { echo "ERROR: $*" >&2; exit 1; }

# Check prerequisites
command -v node >/dev/null 2>&1 || error "node not found. Install Node.js 20+ first."
NODE_MAJOR=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
[ "$NODE_MAJOR" -ge 20 ] 2>/dev/null || error "Node.js 20+ required (found v$(node -v))"
command -v npm >/dev/null 2>&1 || error "npm not found"
command -v git >/dev/null 2>&1 || error "git not found"

# Clone or update
if [ -d "$INSTALL_DIR/.git" ]; then
  info "Updating existing install in $INSTALL_DIR"
  git -C "$INSTALL_DIR" fetch origin "$BRANCH"
  git -C "$INSTALL_DIR" reset --hard "origin/$BRANCH"
else
  info "Cloning $REPO to $INSTALL_DIR"
  git clone --depth 1 --branch "$BRANCH" "https://github.com/$REPO.git" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# Install & build
info "Installing dependencies"
npm ci --ignore-scripts

info "Building"
npm run build

# Create data dirs
mkdir -p mcp-data/{oauth,clones,store}

# Generate .env if not present
if [ ! -f .env ]; then
  if [ -n "${GITHUB_CLIENT_ID:-}" ] && [ -n "${GITHUB_CLIENT_SECRET:-}" ] && [ -n "${BASE_URL:-}" ]; then
    JWT="${JWT_SECRET:-$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")}"
    cat > .env <<EOF
GITHUB_CLIENT_ID=$GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET=$GITHUB_CLIENT_SECRET
BASE_URL=$BASE_URL
JWT_SECRET=$JWT
PORT=${PORT:-62100}
MCP_DATA_DIR=./mcp-data
EOF
    info ".env created"
  else
    cp .env.example .env
    info ".env.example copied to .env — edit it with your credentials:"
    info "  nano $INSTALL_DIR/.env"
  fi
fi

echo ""
echo "Installed to $INSTALL_DIR"
echo ""
echo "Quick start:"
echo "  cd $INSTALL_DIR"
echo "  nano .env              # add GitHub OAuth credentials"
echo "  npm start              # start the server"
echo ""
echo "For Uberspace deployment:"
echo "  bash deploy/setup.sh"
