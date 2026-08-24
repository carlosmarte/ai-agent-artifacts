# GitHub delivery — PR or issue (never in-place edits)

This skill **does not modify the user's code directly.** Every proposed fix is delivered
through GitHub for human review: confident heals become a **pull request**, everything else
becomes a **GitHub issue**. This document is the contract for that delivery layer.

## 1. gh CLI enforcement

All GitHub interaction goes through the official **GitHub CLI (`gh`)**.

- The MCP `github-create_pull_request` tool is **never** invoked, and the driver does **not**
  fall back to it when a `gh` command errors. `gh` provides complete, native, fully-featured
  GitHub coverage (PRs, issues, labels, enterprise hosts); the MCP wrapper is narrower.
- `gh` must be installed (`https://cli.github.com`) and authenticated (`gh auth login`, or a
  token via the env vars below). The driver exits with a clear error if `gh` is missing.
- Always confirm the target repo with `git status` / `git branch` before delivering, and run
  `gh` from inside the repo working copy (or pass `--repo owner/repo`).

### Why CLI over MCP

| | `gh` CLI | `github-create_pull_request` MCP |
| --- | --- | --- |
| API coverage | Complete (PRs, issues, labels, reviews, enterprise) | PR creation only |
| Maintenance | Maintained by GitHub | Wrapper, limited scope |
| Scriptable | Yes, native flags | Constrained inputs |
| Enterprise host | `GH_HOST` / `GH_ENTERPRISE_TOKEN` | Limited |

**Common mistake to avoid:** falling back to the MCP tool when a `gh` command errors out.
Fix the `gh` invocation (auth, host, repo context) instead.

## 2. Custom endpoint & token (`GITHUB_TOKEN`, `GITHUB_BASE_API`)

The driver (`scripts/open-github.sh`) honors two environment variables so it works against
github.com *and* GitHub Enterprise / proxied endpoints:

| Env var | Purpose | What the driver does |
| --- | --- | --- |
| `GITHUB_TOKEN` | Auth token | Exports `GH_TOKEN` (gh also reads `GITHUB_TOKEN` natively). On an enterprise host it also exports `GH_ENTERPRISE_TOKEN`. |
| `GITHUB_BASE_API` | Custom API base, e.g. `https://github.example.com/api/v3` | Derives the bare host (`github.example.com`) and exports it as `GH_HOST` so `gh` targets the right server. github.com / api.github.com are treated as the default (no `GH_HOST` override). |

Example:

```bash
export GITHUB_TOKEN="ghp_…"                                   # or an enterprise PAT
export GITHUB_BASE_API="https://github.example.com/api/v3"     # optional; enterprise only
scripts/open-github.sh --plan ./.pw-heal-plan --repo-dir /path/to/repo
```

## 3. PR-vs-issue decision matrix

The split is computed by `cli.js github-plan` from the `HealResult[]` analysis:

| Heal status | Meaning | Delivery |
| --- | --- | --- |
| `HEALED` | Confidence ≥ threshold, single unambiguous candidate, rewrite produces a diff | Aggregated into **one PR** (one branch, one commit, all healed locators) |
| `AMBIGUOUS` | Two+ candidates tied for top score | **Issue** with the candidate table |
| `ELEMENT_REMOVED` | No candidate above threshold | **Issue** — element likely removed/redesigned |
| `HEAL_FAILED` | Not locator drift, or rewrite produced no change | **Issue** for manual triage |

A confident heal whose replacement would match >1 element is downgraded to an issue rather
than risking a strict-mode failure.

## 4. Flow

```
playwright report ─┐
new DOM ───────────┼─▶  cli.js heal --dry-run   (no file writes)
baseline (opt) ────┘            │  HealResult[]
                                ▼
                     cli.js github-plan --out ./.pw-heal-plan
                                │   writes pr-body.md, issue-N.md, plan.json
                                ▼
              scripts/open-github.sh --plan ./.pw-heal-plan --plan-only   ← REVIEW GATE
                                │   (prints; makes no changes)
                                ▼   user approves
              scripts/open-github.sh --plan ./.pw-heal-plan [--draft]
                     ├─ PR path: clean-tree check → branch off base → replay rewrites
                     │           → commit → push → `gh pr create` → switch back
                     └─ issue path: `gh issue create` per finding
```

### PR path guarantees

- Refuses to run if the working tree is dirty (won't mix the heal with unrelated changes).
- Branches off the base (`--base`, or the repo default), applies rewrites with `--no-backup`
  (branch history *is* the record), commits, pushes, opens the PR.
- Returns to the original branch afterward — **the user's checkout is left untouched.**

## 5. Driver flags

```
scripts/open-github.sh --plan <dir> [options]

  --plan <dir>     github-plan output dir (contains plan.json). Required.
  --repo-dir       Target repo working copy (default: $PWD).
  --repo           owner/repo override (default: plan.repo, else origin remote).
  --base           PR base branch (default: plan.pr.base, else repo default).
  --plan-only      Review gate: print the plan, make no changes, no network calls.
  --pr-only        Only open the PR.
  --issues-only    Only file issues.
  --draft          Open the PR as a draft.
  --yes / -y       Skip the interactive confirmation prompt.
```

## 6. Best practices

- Run `--plan-only` first and show the user the PR body + issue titles before delivering.
- Use descriptive `--title` (github-plan generates one) and Markdown bodies (it does).
- Prefer semantic replacement locators (`getByRole`, `getByTestId`) — see
  [`scoring.md`](scoring.md) for the derivation priority that feeds the PR.
- For draft-first review on shared repos, pass `--draft`.
