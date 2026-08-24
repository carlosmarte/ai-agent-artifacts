#!/usr/bin/env bash
# parity-lint.sh — diff mjs vs py score_description output across fixtures/lint/.
#   1. dump-score parity (mjs vs py) against fixtures/lint/descriptions.json.
#   2. Snapshot agreement against fixtures/lint/expected_scores.json.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

cases="$ROOT/.agents/skills/agent-skill-kit-commons/fixtures/lint/descriptions.json"
expected="$ROOT/.agents/skills/agent-skill-kit-commons/fixtures/lint/expected_scores.json"

mjs_out="$TMP/mjs.json"
py_out="$TMP/py.json"

node "$ROOT/.agents/skills/agent-skill-kit-commons/packages/mjs/bin/dump-score.mjs" "$cases" > "$mjs_out" 2>/dev/null
( cd "$ROOT/.agents/skills/agent-skill-kit-commons/packages/py" && uv run --quiet -- dump-score "$cases" ) > "$py_out" 2>/dev/null

fail=0
if ! diff -u "$mjs_out" "$py_out" >&2; then
  echo "PARITY FAIL: lint (mjs vs py)" >&2
  fail=$((fail + 1))
fi
if [ -f "$expected" ]; then
  if ! diff -u "$expected" "$mjs_out" >&2; then
    echo "PARITY FAIL: lint (mjs drift from expected)" >&2
    fail=$((fail + 1))
  fi
fi

if [ "$fail" -eq 0 ]; then
  echo "parity-lint: OK (mjs == py == expected on 8 fixtures)"
else
  exit 1
fi
