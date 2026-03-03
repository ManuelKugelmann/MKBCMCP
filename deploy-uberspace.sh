#!/bin/bash
# deploy-uberspace.sh — Run on your Uberspace via SSH
# Usage: ssh you@yourhost.uberspace.de < deploy-uberspace.sh
set -euo pipefail

echo "▸ Creating directory"
mkdir -p ~/gh-bootstrap

echo "▸ Writing server"
# (scp gh-bootstrap.js to ~/gh-bootstrap/ first, or paste inline)

echo "▸ Writing supervisord config"
cat > ~/etc/services.d/gh-bootstrap.ini << 'EOF'
[program:gh-bootstrap]
directory=%(ENV_HOME)s/gh-bootstrap
command=node %(ENV_HOME)s/gh-bootstrap/gh-bootstrap.js
autostart=true
autorestart=true
environment=
    GITHUB_PAT="ghp_REPLACE_ME",
    GITHUB_OWNER="ManuelKugelmann",
    AUTH_USER="REPLACE_ME",
    AUTH_PASS="REPLACE_ME",
    PORT="9876"
startsecs=5
EOF

echo "▸ Registering web backend"
uberspace web backend set /gh --http --port 9876

echo "▸ Starting service"
supervisorctl reread
supervisorctl update
supervisorctl start gh-bootstrap

echo "▸ Testing"
sleep 2
curl -s https://$(hostname)/gh/status
echo ""
echo "✓ Done. API at https://$(hostname)/gh/bootstrap"
