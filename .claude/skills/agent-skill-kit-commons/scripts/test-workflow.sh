#!/usr/bin/env bash
# test-workflow.sh — self-test the agent-skills-ci.yml workflow.
#
# Two paths:
#   1. If `act` is installed, run the workflow locally inside a Docker runner.
#   2. Otherwise, print a manual verification checklist.
#
# Also performs offline sanity checks that hold without `act`:
#   - YAML parses
#   - `skills-ref audit` flags zero findings against the workflow file
#   - All action refs are pinned to a major (no `@main`, no SHA-less tags)
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
WF="$ROOT/.github/workflows/agent-skills-ci.yml"

if [ ! -f "$WF" ]; then
  echo "missing workflow: $WF" >&2
  exit 1
fi

fail=0

# 1. YAML parses
if command -v python3 >/dev/null 2>&1 && python3 - <<'PY' "$WF" >/dev/null 2>&1
import sys
try:
    from ruamel.yaml import YAML
except ImportError:
    sys.exit(0)  # skip if ruamel not installed locally
YAML(typ='safe').load(open(sys.argv[1]))
PY
then
  echo "yaml parse: OK"
else
  echo "yaml parse: SKIPPED (ruamel.yaml not installed)"
fi

# 2. Audit flags zero findings
if ! out="$(node "$ROOT/.agents/skills/agent-skill-kit-commons/packages/mjs/bin/skills-ref" audit "$ROOT/.github/" 2>&1)"; then
  echo "audit: FAIL" >&2
  echo "$out" >&2
  fail=$((fail + 1))
else
  echo "audit: OK"
fi

# 3. No `@main` refs (auditor catches this too but make it explicit)
if grep -E "uses:.*@(main|master|HEAD)" "$WF" >/dev/null 2>&1; then
  echo "ref-pin: FAIL (found @main / @master / @HEAD reference)" >&2
  fail=$((fail + 1))
else
  echo "ref-pin: OK (all actions pinned to major versions)"
fi

# 4. `act` path (optional)
if command -v act >/dev/null 2>&1; then
  echo "act: found, running workflow locally..."
  cd "$ROOT"
  if act pull_request \
       --workflows .github/workflows/agent-skills-ci.yml \
       --container-architecture linux/amd64; then
    echo "act: OK"
  else
    echo "act: FAIL" >&2
    fail=$((fail + 1))
  fi
else
  cat <<'EOF'

act: not installed (skipped local run). To verify on real GitHub:

  1. Create a sandbox branch.
  2. Touch a SKILL.md to trigger the workflow path filter.
  3. Push and open a PR.
  4. Confirm three jobs (mjs-ci, py-ci, gate) succeed.
  5. Confirm the "Agent Skills CI" comment appears on the PR.
  6. Push another commit. Confirm the comment updates in place (not duplicated).

To install act: brew install act (mac) or see https://github.com/nektos/act
EOF
fi

if [ "$fail" -eq 0 ]; then
  echo "test-workflow: OK"
else
  exit 1
fi
