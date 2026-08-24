#!/usr/bin/env bash
# parity-read-properties.sh — diff mjs vs py read-properties JSON, single + root modes,
# and verify the 0/1/2 exit-code matrix.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# absolute paths in output need to be normalized to <REPO>/ before snapshot diff
strip_repo() {
  sed "s|$ROOT|<REPO>|g" "$1"
}

single_skill="$ROOT/.agents/skills/agent-skill-kit-commons/fixtures/prompt/registry/prompt-fix-b"
registry="$ROOT/.agents/skills/agent-skill-kit-commons/fixtures/prompt/registry"
malformed="$ROOT/.agents/skills/agent-skill-kit-commons/fixtures/properties/malformed"
nonexistent="$(mktemp -u)"  # path that's guaranteed not to exist; no host-path literal

expected_single="$ROOT/.agents/skills/agent-skill-kit-commons/fixtures/properties/expected_single.json"
expected_root="$ROOT/.agents/skills/agent-skill-kit-commons/fixtures/properties/expected_root.json"

mjs_single="$TMP/mjs-single.json"
py_single="$TMP/py-single.json"
mjs_root="$TMP/mjs-root.json"
py_root="$TMP/py-root.json"

node "$ROOT/.agents/skills/agent-skill-kit-commons/packages/mjs/bin/skills-ref" read-properties "$single_skill" > "$mjs_single" 2>/dev/null
( cd "$ROOT/.agents/skills/agent-skill-kit-commons/packages/py" && uv run --quiet -- skills-ref read-properties "$single_skill" ) > "$py_single" 2>/dev/null
node "$ROOT/.agents/skills/agent-skill-kit-commons/packages/mjs/bin/skills-ref" read-properties --root "$registry" > "$mjs_root" 2>/dev/null
( cd "$ROOT/.agents/skills/agent-skill-kit-commons/packages/py" && uv run --quiet -- skills-ref read-properties --root "$registry" ) > "$py_root" 2>/dev/null

fail=0

# 1. mjs vs py byte-for-byte (single)
if ! diff -u "$mjs_single" "$py_single" >&2; then
  echo "PARITY FAIL: read-properties single mode (mjs vs py)" >&2
  fail=$((fail + 1))
fi
# 2. mjs vs py byte-for-byte (root)
if ! diff -u "$mjs_root" "$py_root" >&2; then
  echo "PARITY FAIL: read-properties root mode (mjs vs py)" >&2
  fail=$((fail + 1))
fi
# 3. mjs (path-normalized) vs expected_single
mjs_single_norm="$TMP/mjs-single-norm.json"
strip_repo "$mjs_single" > "$mjs_single_norm"
if ! diff -u "$expected_single" "$mjs_single_norm" >&2; then
  echo "PARITY FAIL: read-properties single drift from expected" >&2
  fail=$((fail + 1))
fi
# 4. mjs (path-normalized) vs expected_root
mjs_root_norm="$TMP/mjs-root-norm.json"
strip_repo "$mjs_root" > "$mjs_root_norm"
if ! diff -u "$expected_root" "$mjs_root_norm" >&2; then
  echo "PARITY FAIL: read-properties root drift from expected" >&2
  fail=$((fail + 1))
fi

# 5. exit-code matrix: 0 ok / 1 parse fail / 2 not found
check_exit() {
  local runtime="$1"; shift
  local expected_code="$1"; shift
  local label="$1"; shift
  local code
  set +e
  if [ "$runtime" = "mjs" ]; then
    node "$ROOT/.agents/skills/agent-skill-kit-commons/packages/mjs/bin/skills-ref" read-properties "$@" >/dev/null 2>&1
    code=$?
  else
    ( cd "$ROOT/.agents/skills/agent-skill-kit-commons/packages/py" && uv run --quiet -- skills-ref read-properties "$@" >/dev/null 2>&1 )
    code=$?
  fi
  set -e
  if [ "$code" -ne "$expected_code" ]; then
    echo "EXIT-CODE FAIL [$runtime/$label]: got $code, expected $expected_code" >&2
    return 1
  fi
  return 0
}

for rt in mjs py; do
  check_exit "$rt" 0 ok "$single_skill"     || fail=$((fail + 1))
  check_exit "$rt" 1 parse-fail "$malformed" || fail=$((fail + 1))
  check_exit "$rt" 2 not-found "$nonexistent" || fail=$((fail + 1))
done

if [ "$fail" -eq 0 ]; then
  echo "parity-read-properties: OK (mjs == py == expected; exit codes 0/1/2 verified)"
else
  exit 1
fi
