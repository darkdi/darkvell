#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SESSION="${LOCAL_SESSION:-darkvell-local}"

"$ROOT/scripts/stop-local.sh" >/dev/null 2>&1 || true

if ! command -v screen >/dev/null 2>&1; then
  echo "screen is required for detached local run. Install screen or run scripts/local-services.sh in a terminal."
  exit 1
fi

screen -dmS "$SESSION" "$ROOT/scripts/local-services.sh"
sleep 2

echo "Local game: http://localhost:${CLIENT_PREVIEW_PORT:-4173}/"
if command -v ipconfig >/dev/null 2>&1; then
  lan_ip="$(ipconfig getifaddr en0 2>/dev/null || true)"
  if [ -n "$lan_ip" ]; then
    echo "LAN:        http://$lan_ip:${CLIENT_PREVIEW_PORT:-4173}/"
  fi
fi
echo "Stop:       ./scripts/stop-local.sh"
