#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SESSION="${LOCAL_SESSION:-darkvell-local}"

screen -S "$SESSION" -X quit >/dev/null 2>&1 || true

if [ -d "$ROOT/.local-run" ]; then
  for pidfile in "$ROOT"/.local-run/*.pid; do
    [ -f "$pidfile" ] || continue
    pid="$(cat "$pidfile" 2>/dev/null || true)"
    if [ -n "$pid" ]; then
      kill "$pid" 2>/dev/null || true
    fi
  done
fi

sleep 1

if [ -d "$ROOT/.local-run" ]; then
  for pidfile in "$ROOT"/.local-run/*.pid; do
    [ -f "$pidfile" ] || continue
    pid="$(cat "$pidfile" 2>/dev/null || true)"
    if [ -n "$pid" ]; then
      kill -9 "$pid" 2>/dev/null || true
    fi
  done
fi

for port in 4173 5173 3100 3101 3200 3300; do
  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    kill -9 $pids 2>/dev/null || true
  fi
done

echo "Local game services stopped."
