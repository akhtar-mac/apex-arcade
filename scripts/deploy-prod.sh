#!/bin/bash
# Bring up Postgres, Redis, and Nginx. Never start a second API.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "One API process. This script does not start a Docker game server."

if lsof -nP -iTCP:4000 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port 4000 is already in use. That process stays. A second API was not started."
else
  echo "Nothing is listening on port 4000."
  echo "Start the one API from apps/backend: npx tsx src/server.ts"
  echo "The Docker backend stays off so it cannot open a second game clock."
fi

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  docker compose up -d postgres redis pgbouncer nginx
  echo "Postgres, Redis, PgBouncer, and Nginx are the containers. The API container was not started."
else
  echo "Docker is not available. The host API is the only server this script will accept."
fi

if curl -fsS http://127.0.0.1:4000/api/v1/health >/dev/null; then
  echo "API health on :4000 answered."
else
  echo "API health on :4000 did not answer."
  exit 1
fi
