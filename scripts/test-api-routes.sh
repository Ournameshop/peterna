#!/bin/bash
set -u

BASE="http://127.0.0.1:3008"
echo "=== POST /api/image/generate ==="
curl -s -X POST -H 'Content-Type: application/json' \
  --data-binary '{"prompt":"test"}' \
  "$BASE/api/image/generate"
echo

echo "=== POST /api/image/edit ==="
curl -s -X POST -H 'Content-Type: application/json' \
  --data-binary '{"prompt":"x","imageUrls":["https://example.com/a.jpg"]}' \
  "$BASE/api/image/edit"
echo

echo "=== POST /api/video/character-sheet ==="
curl -s -X POST -H 'Content-Type: application/json' \
  --data-binary '{"petPhotoUrl":"https://example.com/a.jpg","styleDirective":"watercolor","petName":"Buddy"}' \
  "$BASE/api/video/character-sheet"
echo

echo "=== POST /api/video/beat ==="
curl -s -X POST -H 'Content-Type: application/json' \
  --data-binary '{"beat":{"archetype":"intro","brief":"hello"},"pet":{"name":"Buddy","species":"dog"}}' \
  "$BASE/api/video/beat"
echo

echo "=== GET /api/video/status ==="
curl -s "$BASE/api/video/status?endpoint=foo&requestId=bar"
echo

echo "=== POST /api/storage/upload (no file) ==="
curl -s -X POST "$BASE/api/storage/upload"
echo

echo "=== ENV CHECK ==="
echo "FAL_KEY set? $(if [ -n "${FAL_KEY:-}" ]; then echo yes; else echo no; fi)"
echo "OPENAI_API_KEY set? $(if [ -n "${OPENAI_API_KEY:-}" ]; then echo yes; else echo no; fi)"
