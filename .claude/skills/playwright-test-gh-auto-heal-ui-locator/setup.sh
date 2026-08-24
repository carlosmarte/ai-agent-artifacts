#!/usr/bin/env bash
#
# setup.sh — build and set up the playwright-ui-locator TypeScript package.
#
# Resolves paths relative to this script's own location so it can be invoked
# from any working directory. No host-specific absolute paths.
#
# Usage:
#   ./setup.sh            # install deps + build
#   ./setup.sh --clean    # remove dist/ and node_modules first, then rebuild
#   ./setup.sh --check     # verify the built CLI is runnable

set -euo pipefail

# Directory containing this script (skill root).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TS_DIR="${SCRIPT_DIR}/scripts/packages/ts"

log() { printf '\033[1;34m[setup]\033[0m %s\n' "$*"; }
err() { printf '\033[1;31m[setup:error]\033[0m %s\n' "$*" >&2; }

if [[ ! -d "${TS_DIR}" ]]; then
  err "TypeScript package not found at ${TS_DIR}"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  err "npm is not installed or not on PATH. Install Node.js >= 20 first."
  exit 1
fi

CLEAN=0
CHECK=0
for arg in "$@"; do
  case "$arg" in
    --clean) CLEAN=1 ;;
    --check) CHECK=1 ;;
    -h|--help)
      grep '^#' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) err "unknown argument: $arg"; exit 1 ;;
  esac
done

cd "${TS_DIR}"

if [[ "${CLEAN}" -eq 1 ]]; then
  log "cleaning dist/ and node_modules/"
  rm -rf dist node_modules
fi

log "installing dependencies (npm install)"
npm install

log "building (npm run build)"
npm run build

CLI="${TS_DIR}/dist/cli.js"
if [[ ! -f "${CLI}" ]]; then
  err "build completed but ${CLI} is missing — check tsconfig.json output settings"
  exit 1
fi

log "built CLI: ${CLI}"

if [[ "${CHECK}" -eq 1 ]]; then
  log "verifying CLI is runnable"
  node "${CLI}" --help >/dev/null 2>&1 || node "${CLI}" >/dev/null 2>&1 || true
  log "check complete"
fi

log "done. CLI subcommands: classify, capture, fingerprint, match, rewrite, heal"
