#!/usr/bin/env bash
# Runs on the server: pull from GitHub, build in a throwaway Node container, serve with nginx.
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
docker run --rm -v "$PWD":/app -w /app node:20-alpine sh -c "npm ci --no-audit --no-fund && npm run build"
docker compose -f deploy/docker-compose.yml up -d
echo "deployed $(git rev-parse --short HEAD)"
