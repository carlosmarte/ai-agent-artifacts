#!/usr/bin/env bash
# parity-parser-naming.sh — 3-way diff mjs vs py vs frozen expected JSON for
# the parser and naming layers. Closes the residual co-drift risk in Gap #1
# (a two-runtime mutual agreement on a wrong answer no longer slips past).
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fail=0
total=0

# Parser cases: diff dump-parsed output vs fixtures/parsed/expected/<case>.json.
while IFS= read -r -d '' case_dir; do
  case="$(basename "$case_dir")"
  expected="$ROOT/.agents/skills/agent-skill-kit-commons/fixtures/parsed/expected/${case}.json"
  [ -f "$expected" ] || { echo "MISSING expected: $expected" >&2; fail=$((fail + 1)); continue; }
  total=$((total + 1))
  mjs_out="$TMP/mjs-parsed-$case.json"
  py_out="$TMP/py-parsed-$case.json"
  node "$ROOT/.agents/skills/agent-skill-kit-commons/packages/mjs/bin/dump-parsed.mjs" --fixture "$case_dir/" > "$mjs_out"
  ( cd "$ROOT/.agents/skills/agent-skill-kit-commons/packages/py" && uv run --quiet -- dump-parsed --fixture "$case_dir/" ) > "$py_out"
  if ! diff -u "$expected" "$mjs_out" >&2; then
    echo "PARITY FAIL: parsed/$case (mjs vs expected)" >&2; fail=$((fail + 1))
  fi
  if ! diff -u "$expected" "$py_out" >&2; then
    echo "PARITY FAIL: parsed/$case (py vs expected)" >&2; fail=$((fail + 1))
  fi
done < <(find "$ROOT/.agents/skills/agent-skill-kit-commons/fixtures/parsed/cases" -mindepth 1 -maxdepth 1 -type d -print0 2>/dev/null)

# Naming cases: diff check-naming output vs fixtures/naming/expected/<case>.json.
while IFS= read -r -d '' case_dir; do
  case="$(basename "$case_dir")"
  expected="$ROOT/.agents/skills/agent-skill-kit-commons/fixtures/naming/expected/${case}.json"
  [ -f "$expected" ] || { echo "MISSING expected: $expected" >&2; fail=$((fail + 1)); continue; }
  total=$((total + 1))
  mjs_out="$TMP/mjs-naming-$case.json"
  py_out="$TMP/py-naming-$case.json"
  node "$ROOT/.agents/skills/agent-skill-kit-commons/packages/mjs/bin/check-naming.mjs" --fixture "$case_dir/" > "$mjs_out"
  ( cd "$ROOT/.agents/skills/agent-skill-kit-commons/packages/py" && uv run --quiet -- check-naming --fixture "$case_dir/" ) > "$py_out"
  if ! diff -u "$expected" "$mjs_out" >&2; then
    echo "PARITY FAIL: naming/$case (mjs vs expected)" >&2; fail=$((fail + 1))
  fi
  if ! diff -u "$expected" "$py_out" >&2; then
    echo "PARITY FAIL: naming/$case (py vs expected)" >&2; fail=$((fail + 1))
  fi
done < <(find "$ROOT/.agents/skills/agent-skill-kit-commons/fixtures/naming/cases" -mindepth 1 -maxdepth 1 -type d -print0 2>/dev/null)

if [ "$fail" -eq 0 ]; then
  echo "parity-parser-naming: OK (mjs == py == expected on $total cases)"
else
  exit 1
fi
