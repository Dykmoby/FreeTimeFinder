#!/usr/bin/env bash
#
# Production deploy / launch for Free Time Finder.
# Installs dependencies, builds the React client, restarts the systemd
# service and waits for the app to answer its health check.
#
# Usage:  ./scripts/deploy.sh      (or:  npm run deploy)
#
set -euo pipefail

SERVICE="freetimefinder"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

step() { printf '\n\033[1;35m==>\033[0m %s\n' "$1"; }

# Node is installed via nvm, so it is not on PATH in a bare shell.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  nvm use default >/dev/null
fi
command -v node >/dev/null || { echo "node not found — is nvm installed?" >&2; exit 1; }

step "Installing dependencies"
npm run install:all

step "Building client"
npm run build

step "Restarting service: $SERVICE"
if ! systemctl cat "$SERVICE" >/dev/null 2>&1; then
  echo "systemd service '$SERVICE' is not installed." >&2
  echo "Either install it (see README) or run the app directly with: npm start" >&2
  exit 1
fi
sudo systemctl restart "$SERVICE"

step "Waiting for health check"
PORT="$(grep -E '^PORT=' server/.env 2>/dev/null | cut -d= -f2)"
PORT="${PORT:-4000}"
if curl -fsS --retry 30 --retry-delay 1 --retry-connrefused \
     "http://localhost:${PORT}/api/health" >/dev/null 2>&1; then
  echo "    app is healthy on port ${PORT}"
else
  echo "    health check failed — check logs: journalctl -u ${SERVICE} -n 50" >&2
  exit 1
fi

step "Done — current status"
sudo systemctl --no-pager --lines=0 status "$SERVICE" | head -n 4
