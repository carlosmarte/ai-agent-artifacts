#!/usr/bin/env bash
# parity-prompt.sh — diff mjs vs py `to-prompt` XML output against frozen expected.xml.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

registry="$ROOT/.agents/skills/agent-skill-kit-commons/fixtures/prompt/registry"
expected="$ROOT/.agents/skills/agent-skill-kit-commons/fixtures/prompt/expected.xml"

mjs_out="$TMP/mjs.xml"
py_out="$TMP/py.xml"

node "$ROOT/.agents/skills/agent-skill-kit-commons/packages/mjs/bin/skills-ref" to-prompt "$registry" > "$mjs_out" 2>/dev/null
( cd "$ROOT/.agents/skills/agent-skill-kit-commons/packages/py" && uv run --quiet -- skills-ref to-prompt "$registry" ) > "$py_out" 2>/dev/null

fail=0
if ! diff -u "$mjs_out" "$py_out" >&2; then
  echo "PARITY FAIL: to-prompt (mjs vs py)" >&2
  fail=$((fail + 1))
fi
if [ -f "$expected" ]; then
  if ! diff -u "$expected" "$mjs_out" >&2; then
    echo "PARITY FAIL: to-prompt (mjs drift from expected)" >&2
    fail=$((fail + 1))
  fi
fi

if [ "$fail" -eq 0 ]; then
  echo "parity-prompt: OK (mjs == py == expected on 5-skill chain)"
else
  exit 1
fi
