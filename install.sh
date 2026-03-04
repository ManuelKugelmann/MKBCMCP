#!/bin/bash
set -euo pipefail

# mkbc-mcp installer
# Usage: curl -fsSL https://raw.githubusercontent.com/ManuelKugelmann/MKBCMCP/main/install.sh | bash
#
# Set env vars before running, or pass interactively:
#   GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
#
# Optional:
#   MKBC_PORT        (default: 62100)
#   MKBC_INSTALL_DIR (default: ~/mkbc-mcp)
#   MKBC_DATA_DIR    (default: ~/mcp-data)

REPO="https://github.com/ManuelKugelmann/MKBCMCP.git"
INSTALL_DIR="${MKBC_INSTALL_DIR:-$HOME/mkbc-mcp}"
DATA_DIR="${MKBC_DATA_DIR:-$HOME/mcp-data}"
PORT="${MKBC_PORT:-62100}"

info()  { echo "  -> $*"; }
error() { echo "ERROR: $*" >&2; exit 1; }

echo "=== mkbc-mcp installer ==="
echo ""

# ── Prereqs ──────────────────────────────────────────────────────────
command -v node >/dev/null 2>&1 || error "node not found. Install Node.js 20+."
NODE_MAJOR=$(node -e "process.stdout.write(String(process.versions.node.split('.')[0]))")
[ "$NODE_MAJOR" -ge 20 ] 2>/dev/null || error "Node.js 20+ required (found v$(node -v))"
command -v git  >/dev/null 2>&1 || error "git not found."
info "Node $(node -v) OK"

# ── Clone / Update ───────────────────────────────────────────────────
if [ -d "$INSTALL_DIR/.git" ]; then
  info "Updating existing install at $INSTALL_DIR"
  git -C "$INSTALL_DIR" pull --ff-only origin main
else
  info "Cloning to $INSTALL_DIR"
  git clone "$REPO" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# ── Build ────────────────────────────────────────────────────────────
info "Installing dependencies..."
npm ci --ignore-scripts 2>/dev/null || npm install
info "Building..."
npm run build

# ── Data dirs ────────────────────────────────────────────────────────
mkdir -p "$DATA_DIR"/{oauth,clones,store}
mkdir -p "$HOME/logs"

# ── .env ─────────────────────────────────────────────────────────────
ENV_FILE="$INSTALL_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  # Prompt for required values if not set
  if [ -z "${GITHUB_CLIENT_ID:-}" ]; then
    printf "GitHub OAuth Client ID: " && read -r GITHUB_CLIENT_ID
  fi
  if [ -z "${GITHUB_CLIENT_SECRET:-}" ]; then
    printf "GitHub OAuth Client Secret: " && read -r GITHUB_CLIENT_SECRET
  fi

  HOSTNAME_GUESS=$(hostname -f 2>/dev/null || hostname)
  BASE_URL="${MKBC_BASE_URL:-https://$HOSTNAME_GUESS}"

  cat > "$ENV_FILE" <<EOF
GITHUB_CLIENT_ID=$GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET=$GITHUB_CLIENT_SECRET
BASE_URL=$BASE_URL
PORT=$PORT
MCP_DATA_DIR=$DATA_DIR
EOF
  info "Created $ENV_FILE"
else
  info ".env already exists, skipping"
fi

# ── Supervisord (Uberspace) ─────────────────────────────────────────
if [ -d "$HOME/etc/services.d" ]; then
  SERVICE_FILE="$HOME/etc/services.d/mkbc-mcp.ini"
  cat > "$SERVICE_FILE" <<EOF
[program:mkbc-mcp]
command=node $INSTALL_DIR/dist/server.js
directory=$INSTALL_DIR
environment=NODE_ENV="production"
autostart=true
autorestart=true
startsecs=10
startretries=3
stderr_logfile=$HOME/logs/mkbc-mcp.err.log
stdout_logfile=$HOME/logs/mkbc-mcp.out.log
EOF
  supervisorctl reread 2>/dev/null && supervisorctl update 2>/dev/null || true
  info "Supervisord service installed"
fi

# ── Web backend (Uberspace) ─────────────────────────────────────────
if command -v uberspace >/dev/null 2>&1; then
  uberspace web backend set / --http --port "$PORT" 2>/dev/null || true
  info "Uberspace web backend configured on port $PORT"
fi

echo ""
echo "=== Done! ==="
echo ""
echo "  Install dir:  $INSTALL_DIR"
echo "  Data dir:     $DATA_DIR"
echo "  Config:       $ENV_FILE"
echo ""
echo "Start manually:  cd $INSTALL_DIR && node --env-file=.env dist/server.js"
echo ""
echo "Add to claude.ai:"
echo "  Settings -> Connectors -> Add custom connector"
echo "  URL: <your BASE_URL>/mcp"
echo ""
