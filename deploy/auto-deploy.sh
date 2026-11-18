#!/usr/bin/env bash
# Run from cron every minute on the server. If main has a new commit on GitHub, deploy it.
# Prints only when it deploys, so the log stays short.
set -euo pipefail
cd "$(dirname "$0")/.."
git fetch -q origin main
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] && exit 0
echo "$(date -Is) new commit $(git rev-parse --short origin/main), deploying"
./deploy/deploy.sh
