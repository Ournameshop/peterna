#!/bin/bash
# Restore the staging .env after rsync --delete nukes it.
# Source of truth: /home/zeeshan/.peterna-env/staging.env (outside the rsync target).
set -eu

SRC="$HOME/.peterna-env/staging.env"
DST="$HOME/apps/peterna-staging/.env"

if [ ! -f "$SRC" ]; then
  echo "ERR: $SRC not found — create it first with the real keys"
  exit 1
fi

cp -f "$SRC" "$DST"
chmod 600 "$DST"
echo "wrote $DST ($(wc -c < $DST) bytes)"

pm2 reload peterna-staging --update-env
sleep 3
echo
echo "=== probe /api/image/generate ==="
curl -s -X POST -H 'Content-Type: application/json' \
  --data-binary '{"prompt":"smoke"}' \
  http://127.0.0.1:3008/api/image/generate
echo
