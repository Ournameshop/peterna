#!/bin/bash
echo "=== upload route reference (indicates USE_FAL=true baked in) ==="
grep -rl '/api/storage/upload' /home/zeeshan/apps/peterna-staging/.next/static 2>/dev/null | head -5
echo
echo "=== character-sheet route reference ==="
grep -rl '/api/video/character-sheet' /home/zeeshan/apps/peterna-staging/.next/static 2>/dev/null | head -5
echo
echo "=== remoteUrl (only set in the USE_FAL path) ==="
grep -rl 'remoteUrl' /home/zeeshan/apps/peterna-staging/.next/static 2>/dev/null | head -3
