#!/bin/bash
# Smoke-test fal routes on local staging port.
set -u
BASE="http://127.0.0.1:3008"
echo "=== /api/image/generate ==="
curl -s -X POST -H 'Content-Type: application/json' \
  --data-binary '{"prompt":"a single golden retriever in soft golden hour light, photoreal, cinematic","quality":"medium","aspect":"square_hd"}' \
  "$BASE/api/image/generate"
echo
echo
echo "=== /api/video/beat (fast preview, queue submit) ==="
curl -s -X POST -H 'Content-Type: application/json' \
  --data-binary '{"beat":{"archetype":"intro","brief":"a golden dog walking in a meadow at sunrise"},"pet":{"name":"Buddy","species":"dog"},"resolution":"480p","duration":"5","mode":"fast","wait":false}' \
  "$BASE/api/video/beat"
echo
