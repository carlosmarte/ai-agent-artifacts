#!/usr/bin/env bash
# run-parity.sh — diff mjs vs py output across the fixture tree.
#   1. Per-skill validate parity (every fixtures/**/SKILL.md, excluding deps/).
#   2. Per-deps-fixture-root dump-deps parity (fixtures/deps/<case>/ vs expected).
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fail=0
total=0

# Section 1: per-skill validate parity (skip deps/ subtree — those are graph fixtures, not solo validation cases).
while IFS= read -r skill_md; do
  fix="$(dirname "$skill_md")"
  case="$(basename "$fix")"
  # Skip skills under fixtures/deps/<case>/ — covered separately below.
  case "$fix" in
    "$ROOT"/.agents/skills/agent-skill-kit-commons/fixtures/deps/*) continue ;;
  esac
  total=$((total + 1))
  mjs_out="$TMP/mjs-$case.json"
  py_out="$TMP/py-$case.json"
  node "$ROOT/.agents/skills/agent-skill-kit-commons/packages/mjs/bin/skills-ref" validate "$fix" --format json --no-color > "$mjs_out" 2>/dev/null || true
  ( cd "$ROOT/.agents/skills/agent-skill-kit-commons/packages/py" && uv run --quiet -- skills-ref validate "$fix" --format json --no-color ) > "$py_out" 2>/dev/null || true
  if ! diff -u "$mjs_out" "$py_out" >&2; then
    echo "PARITY FAIL: validate/$case" >&2
    fail=$((fail + 1))
  fi
done < <(find "$ROOT/.agents/skills/agent-skill-kit-commons/fixtures" -mindepth 2 -name "SKILL.md" -type f 2>/dev/null | sort)

# Section 2a: per-audit-fixture-root audit parity (mjs vs py).
if [ -d "$ROOT/.agents/skills/agent-skill-kit-commons/fixtures/audit" ]; then
  while IFS= read -r -d '' adir; do
    case="$(basename "$adir")"
    total=$((total + 1))
    mjs_out="$TMP/mjs-audit-$case.json"
    py_out="$TMP/py-audit-$case.json"
    node "$ROOT/.agents/skills/agent-skill-kit-commons/packages/mjs/bin/skills-ref" audit "$adir" --format json > "$mjs_out" 2>/dev/null || true
    ( cd "$ROOT/.agents/skills/agent-skill-kit-commons/packages/py" && uv run --quiet -- skills-ref audit "$adir" --format json ) > "$py_out" 2>/dev/null || true
    if ! diff -u "$mjs_out" "$py_out" >&2; then
      echo "PARITY FAIL: audit/$case (mjs vs py)" >&2
      fail=$((fail + 1))
    fi
  done < <(find "$ROOT/.agents/skills/agent-skill-kit-commons/fixtures/audit" -mindepth 1 -maxdepth 1 -type d -print0 2>/dev/null)
fi

# Section 2b: per-deps-fixture-root dump-deps parity + expected-snapshot agreement.
if [ -d "$ROOT/.agents/skills/agent-skill-kit-commons/fixtures/deps" ]; then
  while IFS= read -r -d '' depdir; do
    case="$(basename "$depdir")"
    [ "$case" = "expected" ] && continue
    total=$((total + 1))
    mjs_out="$TMP/mjs-deps-$case.json"
    py_out="$TMP/py-deps-$case.json"
    node "$ROOT/.agents/skills/agent-skill-kit-commons/packages/mjs/bin/dump-deps.mjs" "$depdir" > "$mjs_out" 2>/dev/null || true
    ( cd "$ROOT/.agents/skills/agent-skill-kit-commons/packages/py" && uv run --quiet -- dump-deps "$depdir" ) > "$py_out" 2>/dev/null || true
    if ! diff -u "$mjs_out" "$py_out" >&2; then
      echo "PARITY FAIL: deps/$case (mjs vs py)" >&2
      fail=$((fail + 1))
      continue
    fi
    expected="$ROOT/.agents/skills/agent-skill-kit-commons/fixtures/deps/expected/$case.json"
    if [ -f "$expected" ]; then
      if ! diff -u "$expected" "$mjs_out" >&2; then
        echo "PARITY FAIL: deps/$case (output drifted from expected)" >&2
        fail=$((fail + 1))
      fi
    fi
  done < <(find "$ROOT/.agents/skills/agent-skill-kit-commons/fixtures/deps" -mindepth 1 -maxdepth 1 -type d -print0 2>/dev/null)
fi

echo "parity: $((total - fail))/$total fixtures agreed"
[ "$fail" -eq 0 ]
