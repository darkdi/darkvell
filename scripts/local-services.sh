#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ -f "$ROOT/.env.local" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env.local"
  set +a
fi

export PATH="$ROOT/.tools/node/bin:$PATH"
export GAME_HTTP_PORT="${GAME_HTTP_PORT:-3100}"
export GAME_WS_PORT="${GAME_WS_PORT:-3101}"
export AUTH_HTTP_PORT="${AUTH_HTTP_PORT:-3200}"
export BLOCKCHAIN_HTTP_PORT="${BLOCKCHAIN_HTTP_PORT:-3300}"
export CLIENT_PREVIEW_PORT="${CLIENT_PREVIEW_PORT:-4173}"
export GAME_TICK_MS="${GAME_TICK_MS:-66}"
export GAME_SNAPSHOT_MS="${GAME_SNAPSHOT_MS:-80}"
export GAME_BOT_COUNT="${GAME_BOT_COUNT:-60}"
export TON_NETWORK="${TON_NETWORK:-testnet}"

mkdir -p "$ROOT/.local-run"

pids=()

start_service() {
  local name="$1"
  local dir="$2"
  shift 2

  (
    cd "$ROOT/$dir"
    exec "$@"
  ) > "$ROOT/.local-run/$name.log" 2>&1 &

  local pid=$!
  pids+=("$pid")
  echo "$pid" > "$ROOT/.local-run/$name.pid"
}

cleanup() {
  for pid in "${pids[@]:-}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}

trap cleanup EXIT INT TERM HUP

start_service game-server game-server "$ROOT/.tools/node/bin/node" dist/main.js
start_service auth-server auth-server "$ROOT/.tools/node/bin/node" dist/main.js
start_service blockchain-service blockchain-service "$ROOT/.tools/node/bin/node" dist/main.js
start_service client-preview client "$ROOT/node_modules/.bin/vite" preview --host 0.0.0.0 --port "$CLIENT_PREVIEW_PORT"

wait
