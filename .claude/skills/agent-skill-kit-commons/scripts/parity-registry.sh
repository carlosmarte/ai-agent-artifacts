#!/usr/bin/env bash
# parity-registry.sh — diff mjs vs py registry dump for the suite's own skills.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
TARGET="${1:-$ROOT/.agents/skills}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

node "$ROOT/.agents/skills/agent-skill-kit-commons/packages/mjs/bin/dump-registry.mjs" "$TARGET" > "$TMP/mjs.json" 2>/dev/null
( cd "$ROOT/.agents/skills/agent-skill-kit-commons/packages/py" && uv run --quiet -- dump-registry "$TARGET" ) > "$TMP/py.json" 2>/dev/null

if diff -u "$TMP/mjs.json" "$TMP/py.json"; then
  echo "parity-registry: OK ($TARGET)"
  exit 0
fi
echo "parity-registry: FAIL ($TARGET)" >&2
exit 1
