#!/usr/bin/env bash
#
# open-github.sh — turn a github-plan artifact dir into a PR and/or issues via
# the official GitHub CLI (`gh`).
#
# Hard rules (see ../references/github-delivery.md):
#   - ONLY the `gh` CLI is used. The MCP `github-create_pull_request` tool is
#     never invoked from here. `gh` gives complete, native API coverage.
#   - The user's current branch and working tree are NEVER mutated. Confident
#     heals are applied on a fresh branch and proposed as a PR for review.
#   - Custom GitHub endpoints are honored via GITHUB_TOKEN and GITHUB_BASE_API.
#
# Usage:
#   ./open-github.sh --plan <dir> [--repo owner/repo] [--base <branch>]
#                    [--repo-dir <path>] [--plan-only] [--issues-only] [--pr-only]
#                    [--draft] [--yes]
#
#   --plan <dir>     Directory produced by `cli.js github-plan` (has plan.json). Required.
#   --repo-dir       The target git repo working copy (default: $PWD).
#   --repo           owner/repo override (default: plan.repo, else the origin remote).
#   --base           PR base branch (default: plan.pr.base, else repo default).
#   --plan-only      Print what WOULD happen (review gate); make no changes, no network calls.
#   --pr-only        Only open the PR (skip issues).
#   --issues-only    Only file issues (skip the PR).
#   --draft          Open the PR as a draft.
#   --yes            Skip the interactive confirmation prompt.
#
# Env:
#   GITHUB_TOKEN     Auth token. Exported to GH_TOKEN (and GH_ENTERPRISE_TOKEN
#                    when GITHUB_BASE_API points at an enterprise host).
#   GITHUB_BASE_API  Custom API base, e.g. https://github.example.com/api/v3 .
#                    Its host is exported as GH_HOST so gh targets the right server.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI="${SCRIPT_DIR}/packages/ts/dist/cli.js"

log()  { printf '\033[1;34m[gh]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[gh:warn]\033[0m %s\n' "$*" >&2; }
err()  { printf '\033[1;31m[gh:error]\033[0m %s\n' "$*" >&2; }

PLAN_DIR=""
REPO_DIR="${PWD}"
REPO=""
BASE=""
PLAN_ONLY=0
PR_ONLY=0
ISSUES_ONLY=0
DRAFT=0
ASSUME_YES=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --plan) PLAN_DIR="$2"; shift 2 ;;
    --repo-dir) REPO_DIR="$2"; shift 2 ;;
    --repo) REPO="$2"; shift 2 ;;
    --base) BASE="$2"; shift 2 ;;
    --plan-only) PLAN_ONLY=1; shift ;;
    --pr-only) PR_ONLY=1; shift ;;
    --issues-only) ISSUES_ONLY=1; shift ;;
    --draft) DRAFT=1; shift ;;
    --yes|-y) ASSUME_YES=1; shift ;;
    -h|--help) grep '^#' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) err "unknown argument: $1"; exit 2 ;;
  esac
done

[[ -n "${PLAN_DIR}" ]] || { err "--plan <dir> is required"; exit 2; }
PLAN_JSON="${PLAN_DIR}/plan.json"
[[ -f "${PLAN_JSON}" ]] || { err "plan.json not found in ${PLAN_DIR} (run 'cli.js github-plan --out ${PLAN_DIR}' first)"; exit 2; }

# --- small node-backed JSON reader (avoids a jq dependency) ---------------
# jget <expr>  — prints the evaluated expression against the parsed plan as `p`.
jget() {
  node -e '
    const p = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const v = (() => { try { return eval(process.argv[2]); } catch { return ""; } })();
    if (v === undefined || v === null) process.stdout.write("");
    else process.stdout.write(String(v));
  ' "${PLAN_JSON}" "$1"
}

# --- configure gh for custom endpoints ------------------------------------
configure_gh_env() {
  if [[ -n "${GITHUB_TOKEN:-}" && -z "${GH_TOKEN:-}" ]]; then
    export GH_TOKEN="${GITHUB_TOKEN}"
  fi
  if [[ -n "${GITHUB_BASE_API:-}" ]]; then
    # Derive bare host from e.g. https://github.example.com/api/v3 -> github.example.com
    local host
    host="$(printf '%s' "${GITHUB_BASE_API}" | sed -E 's#^https?://##; s#/.*$##')"
    if [[ -n "${host}" && "${host}" != "api.github.com" && "${host}" != "github.com" ]]; then
      export GH_HOST="${host}"
      if [[ -n "${GITHUB_TOKEN:-}" && -z "${GH_ENTERPRISE_TOKEN:-}" ]]; then
        export GH_ENTERPRISE_TOKEN="${GITHUB_TOKEN}"
      fi
      log "targeting GitHub host: ${GH_HOST} (from GITHUB_BASE_API)"
    fi
  fi
}

# --- resolve repo ---------------------------------------------------------
resolve_repo() {
  if [[ -n "${REPO}" ]]; then return; fi
  local from_plan; from_plan="$(jget 'p.repo')"
  if [[ -n "${from_plan}" ]]; then REPO="${from_plan}"; return; fi
  # else leave empty — gh infers from the origin remote of REPO_DIR.
}

# --- review-gate print ----------------------------------------------------
print_plan() {
  local has_pr issue_count
  has_pr="$(jget 'p.pr ? "yes" : "no"')"
  issue_count="$(jget 'p.issues.length')"
  echo "============================================================"
  echo " Playwright heal — GitHub delivery plan"
  echo " repo: ${REPO:-<origin remote of ${REPO_DIR}>}"
  echo "============================================================"
  if [[ "${has_pr}" == "yes" && "${ISSUES_ONLY}" -ne 1 ]]; then
    echo
    echo "PULL REQUEST"
    echo "  title : $(jget 'p.pr.title')"
    echo "  branch: $(jget 'p.pr.branch')"
    echo "  base  : ${BASE:-$(jget 'p.pr.base || "(repo default)"')}"
    echo "  fixes : $(jget 'p.pr.rewrites.length') locator(s)"
    echo "  body  :"
    sed 's/^/    /' "${PLAN_DIR}/$(basename "$(jget 'p.pr.bodyFile')")" 2>/dev/null \
      || sed 's/^/    /' "$(jget 'p.pr.bodyFile')"
  fi
  if [[ "${issue_count}" -gt 0 && "${PR_ONLY}" -ne 1 ]]; then
    echo
    echo "ISSUES (${issue_count})"
    local i=0
    while [[ $i -lt ${issue_count} ]]; do
      echo "  - $(jget "p.issues[$i].title")"
      i=$((i+1))
    done
  fi
  echo
  echo "============================================================"
}

confirm() {
  [[ "${ASSUME_YES}" -eq 1 ]] && return 0
  read -r -p "Proceed with the above using gh? [y/N] " ans
  [[ "${ans}" == "y" || "${ans}" == "Y" ]]
}

# --- PR creation ----------------------------------------------------------
open_pr() {
  local title branch base body_file rewrite_count
  title="$(jget 'p.pr.title')"
  branch="$(jget 'p.pr.branch')"
  base="${BASE:-$(jget 'p.pr.base')}"
  body_file="$(jget 'p.pr.bodyFile')"
  rewrite_count="$(jget 'p.pr.rewrites.length')"

  [[ -n "${title}" ]] || { warn "no PR in plan; skipping"; return 0; }

  log "preparing PR branch '${branch}' with ${rewrite_count} locator fix(es)"

  ( cd "${REPO_DIR}"

    if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
      err "${REPO_DIR} is not a git repository"; exit 1
    fi
    if [[ -n "$(git status --porcelain)" ]]; then
      err "working tree at ${REPO_DIR} is not clean. Commit/stash first — this skill refuses to mix its fix with unrelated changes."
      exit 1
    fi

    local start_ref
    start_ref="$(git rev-parse --abbrev-ref HEAD)"
    log "current branch: ${start_ref}"

    if [[ -n "${base}" ]]; then
      git fetch origin "${base}" --quiet || warn "could not fetch base '${base}'; branching off ${start_ref}"
      git switch -c "${branch}" "origin/${base}" 2>/dev/null || git switch -c "${branch}"
    else
      git switch -c "${branch}"
    fi

    # Replay each rewrite on the branch (--no-backup: branch history is the record).
    local i=0
    while [[ $i -lt ${rewrite_count} ]]; do
      local f a o n
      f="$(jget "p.pr.rewrites[$i].file")"
      a="$(jget "p.pr.rewrites[$i].api")"
      o="$(jget "p.pr.rewrites[$i].old")"
      n="$(jget "p.pr.rewrites[$i].new")"
      log "rewrite: ${f}  .${a}('${o}') -> ${n}"
      node "${CLI}" rewrite --file "${f}" --api "${a}" --old "${o}" --new "${n}" --no-backup >/dev/null
      i=$((i+1))
    done

    if [[ -z "$(git status --porcelain)" ]]; then
      err "no file changes produced by rewrites — aborting PR. Re-check the heal results."
      git switch "${start_ref}"; git branch -D "${branch}"; exit 1
    fi

    git add -A
    git commit -m "$(printf '%s\n\nAuto-healed Playwright locators after a UI/DOM change.\nReview before merging.' "${title}")" --quiet
    git push -u origin "${branch}" --quiet

    local pr_args=(pr create --title "${title}" --body-file "${body_file}" --head "${branch}")
    [[ -n "${base}" ]] && pr_args+=(--base "${base}")
    [[ -n "${REPO}" ]] && pr_args+=(--repo "${REPO}")
    [[ "${DRAFT}" -eq 1 ]] && pr_args+=(--draft)

    log "gh ${pr_args[*]}"
    gh "${pr_args[@]}"

    git switch "${start_ref}" --quiet
    log "returned to '${start_ref}'. The fix lives only on '${branch}' / the PR."
  )
}

# --- issue creation -------------------------------------------------------
open_issues() {
  local count; count="$(jget 'p.issues.length')"
  [[ "${count}" -gt 0 ]] || { log "no issues to file"; return 0; }
  local i=0
  while [[ $i -lt ${count} ]]; do
    local title body_file labels
    title="$(jget "p.issues[$i].title")"
    body_file="$(jget "p.issues[$i].bodyFile")"
    labels="$(jget "p.issues[$i].labels.join(',')")"

    local issue_args=(issue create --title "${title}" --body-file "${body_file}")
    [[ -n "${labels}" ]] && issue_args+=(--label "${labels}")
    [[ -n "${REPO}" ]] && issue_args+=(--repo "${REPO}")

    log "gh ${issue_args[*]}"
    ( cd "${REPO_DIR}" && gh "${issue_args[@]}" )
    i=$((i+1))
  done
}

# --- main -----------------------------------------------------------------
configure_gh_env
resolve_repo
print_plan

if [[ "${PLAN_ONLY}" -eq 1 ]]; then
  log "--plan-only: no changes made. Re-run without it (or with --yes) to execute."
  exit 0
fi

if ! command -v gh >/dev/null 2>&1; then
  err "the GitHub CLI 'gh' is not installed. Install it (https://cli.github.com) — this skill does not fall back to MCP tools."
  exit 1
fi

if ! confirm; then
  log "aborted by user. No changes made."
  exit 0
fi

if [[ "${ISSUES_ONLY}" -ne 1 ]]; then open_pr; fi
if [[ "${PR_ONLY}" -ne 1 ]]; then open_issues; fi

log "done."
