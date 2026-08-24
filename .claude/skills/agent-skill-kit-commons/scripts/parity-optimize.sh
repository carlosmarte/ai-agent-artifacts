#!/usr/bin/env bash
# parity-optimize.sh — diff mjs vs py optimize JSON output against frozen snapshot.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

strip_repo() {
  sed "s|$ROOT|<REPO>|g" "$1"
}

fixture="$ROOT/.agents/skills/agent-skill-kit-commons/fixtures/optimize/low-score-vague"
expected="$ROOT/.agents/skills/agent-skill-kit-commons/fixtures/optimize/expected/low-score-vague.json"

mjs_out="$TMP/mjs.json"
py_out="$TMP/py.json"
mjs_norm="$TMP/mjs-norm.json"

node "$ROOT/.agents/skills/agent-skill-kit-commons/packages/mjs/bin/skills-ref" optimize "$fixture" --format json > "$mjs_out" 2>/dev/null
( cd "$ROOT/.agents/skills/agent-skill-kit-commons/packages/py" && uv run --quiet -- skills-ref optimize "$fixture" --format json ) > "$py_out" 2>/dev/null

fail=0
if ! diff -u "$mjs_out" "$py_out" >&2; then
  echo "PARITY FAIL: optimize (mjs vs py)" >&2
  fail=$((fail + 1))
fi
strip_repo "$mjs_out" > "$mjs_norm"
if ! diff -u "$expected" "$mjs_norm" >&2; then
  echo "PARITY FAIL: optimize drift from expected snapshot" >&2
  fail=$((fail + 1))
fi

if [ "$fail" -eq 0 ]; then
  echo "parity-optimize: OK (mjs == py == expected)"
else
  exit 1
fi
