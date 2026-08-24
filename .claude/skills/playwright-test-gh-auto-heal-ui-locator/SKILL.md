---
name: playwright-ui-locator
description: Auto-heal Playwright tests after a frontend developer changes a div's class, id, or other selector. Catches a failing Playwright test, captures the old vs new DOM tree, finds the element that drifted, derives the most stable replacement locator, and proposes the fix as a GitHub pull request (confident heals) or files a GitHub issue (ambiguous / element-removed cases) — never editing the working tree directly. Trigger when Playwright tests fail with "locator resolved to 0 elements", "Timeout waiting for selector", or after a UI refactor / class rename / Tailwind cleanup broke previously-passing tests.
allowed-tools: Bash,Read,Write,Edit,Glob,Grep
argument-hint: "<failing-test-file> [--report <playwright-json-report>] [--baseline <old-dom-snapshot>] [--repo <owner/repo>]"
disable-model-invocation: false
---

# Playwright UI Locator Auto-Healer

Restore a broken Playwright test after a CSS class, `id`, or DOM-shape change has invalidated its locator. The skill orchestrates: detect the failing selector → rebuild the old element fingerprint → match it against the new DOM → pick the most stable replacement → **deliver the fix through GitHub for human review**.

> **The skill never edits the user's working tree or current branch.** Confident heals are
> applied on a fresh branch and proposed as a **pull request**; ambiguous / element-removed
> cases are filed as a **GitHub issue** with the candidate scores. All GitHub interaction goes
> through the official `gh` CLI — see [GitHub delivery](#github-delivery-pr-or-issue) below.

The heavy lifting lives in the bundled TypeScript package at [`scripts/packages/ts/`](scripts/packages/ts/). The agent's job in this skill is to drive that package against the user's repo, not to re-implement DOM diffing in prompt-land.

## When to use

- A Playwright test that was green yesterday now errors with `locator.click: Timeout`, `strict mode violation`, or `expected count: 1, received: 0`.
- A frontend dev renamed Tailwind classes, swapped `id` for `data-testid`, or migrated from `div > span` to `button > span`.
- A design-system upgrade replaced raw element types (`<div role="button">` → `<button>`).
- The user asks to "fix the broken Playwright tests" or "auto-update the selectors".

Do NOT trigger for:

- New tests being written from scratch (use `playwright-feature-validator`).
- Failures unrelated to selectors (assertion-value drift, backend changes, flaky waits).

## Inputs

The user provides at least one of:

1. A path to a failing test file: `tests/checkout.spec.ts`
2. A Playwright JSON report (preferred): produced by `npx playwright test --reporter=json > report.json`
3. An optional baseline DOM snapshot (HTML file, or path to a previous `page.content()` dump). If absent, the package falls back to git history — it `git show HEAD~1:<rendered-fixture>` if a fixture exists, otherwise it diffs against the locator string itself.

If only a directory is given, scan it for `*.spec.ts` / `*.spec.js` files and ask which one to heal.

## Step-by-step procedure

### 1. Verify the failure

Before touching anything, confirm the test actually fails for a locator reason — not for a logic bug. Run:

```bash
cd <repo-root>
npx playwright test <test-file> --reporter=json > /tmp/pw-report.json || true
node scripts/packages/ts/dist/cli.js classify --report /tmp/pw-report.json
```

Output is one of: `LOCATOR_DRIFT` (proceed), `ASSERTION_DRIFT` (stop — not this skill's job), `INFRA_ERROR` (stop — environment issue), `UNKNOWN` (ask the user).

### 2. Capture the new DOM

Re-run the failing test with tracing on so the package can read the rendered page state at the moment of failure:

```bash
npx playwright test <test-file> --trace on || true
node scripts/packages/ts/dist/cli.js capture \
  --trace test-results/<...>/trace.zip \
  --out /tmp/pw-newdom.html
```

If the test fails _before_ navigation completes, the package falls back to spawning the same URL via a one-shot headless run and dumping `page.content()`.

### 3. Build the old-element fingerprint

For each failing locator string in the report, the package builds a fingerprint:

- Tag name
- Visible text content (trimmed, collapsed whitespace)
- `role`, `aria-label`, `data-testid`, `name`, `placeholder`, `title`
- Sibling index within its parent
- Ancestor chain (up to 3 levels) — tag + role

Sources, in priority order: (a) explicit `--baseline` snapshot, (b) git-history-resolved fixture, (c) the locator string itself parsed into a partial fingerprint.

### 4. Score candidates in the new DOM

Every visible element in the captured new-DOM is scored against the fingerprint. Weights (see [`references/scoring.md`](references/scoring.md) for the full table):

| Signal              | Weight |
| ------------------- | ------ |
| `data-testid` match | 100    |
| Text content match  | 60     |
| `role` + `name`     | 50     |
| Tag + ancestor path | 30     |
| `aria-label`        | 25     |
| `id`                | 20     |
| Class overlap       | 10     |

The highest-scoring candidate above a confidence threshold (default `0.75`) wins. Below threshold → ask the user.

### 5. Derive a stable replacement locator

Prefer locators in this order — pick the first that uniquely identifies the candidate:

1. `getByTestId('…')` — if `data-testid` present
2. `getByRole('…', { name: '…' })` — semantic + accessible name
3. `getByLabel('…')` / `getByPlaceholder('…')` — form fields
4. `getByText('…', { exact: true })` — static labels
5. `locator('#id')` — stable id
6. `locator('[data-…]')` — other stable data attributes
7. `locator('css-path')` — last resort, only if no semantic anchor exists

Class selectors (`.btn-primary`) are _never_ emitted — they're the failure mode the skill exists to escape.

### 6. Produce a delivery plan (no working-tree writes)

Run the heal in **analysis-only** mode and turn the result into a GitHub delivery plan. This step writes *artifacts* (PR/issue bodies + a manifest) to an output dir — it does **not** touch git, the working tree, or the network.

```bash
node scripts/packages/ts/dist/cli.js github-plan \
  --report /tmp/pw-report.json \
  --new-dom /tmp/pw-newdom.html \
  --baseline /tmp/old-dom.html \
  --threshold 0.8 \
  --out ./.pw-heal-plan \
  --repo <owner/repo>          # optional; falls back to the origin remote
```

Internally this runs a **dry-run** heal (the AST rewriter computes the diff but writes nothing) and splits the results:

- **`HEALED`** (above threshold, unambiguous) → a single aggregated **pull request**, with each drifted locator replaced on a dedicated branch.
- **`AMBIGUOUS` / `ELEMENT_REMOVED` / `HEAL_FAILED`** → one **GitHub issue** each, documenting the drift, the Playwright error, and the ranked candidate scores so a human can decide.

Class selectors (`.btn-primary`) are never emitted — they are the failure mode the skill exists to escape. A replacement that would match >1 element is downgraded to an issue rather than risking a strict-mode failure.

### 7. Review the proposed files, then deliver

**Always show the user the plan first** (the PR diff/body and any issue bodies) and get a go-ahead before anything is pushed. The driver has a built-in review gate:

```bash
# Review gate — prints the PR body, branch, and issue titles; makes NO changes.
scripts/open-github.sh --plan ./.pw-heal-plan --plan-only
```

Once the user approves, deliver via the **`gh` CLI** (never the `github-create_pull_request` MCP tool):

```bash
scripts/open-github.sh --plan ./.pw-heal-plan --repo-dir <repo> [--base main] [--draft]
```

The driver, for the PR path: refuses to run on a dirty tree, branches off the base, replays each rewrite on that branch, commits, pushes, and opens the PR with `gh pr create` — then switches back to the original branch so the user's checkout is untouched. For the issue path it runs `gh issue create` per finding.

It honors a custom GitHub endpoint and token via `GITHUB_TOKEN` and `GITHUB_BASE_API` (see [GitHub delivery](#github-delivery-pr-or-issue)).

## Output

End the turn with a structured report:

```
## playwright-ui-locator result

Test:        tests/checkout.spec.ts:42
Status:      HEALED → PR opened
Confidence:  0.91

Old locator: page.locator('.btn-primary')
New locator: page.getByRole('button', { name: 'Place order' })

Delivery:    PR  #128  playwright-heal/20260526-013337 → main
             https://github.com/acme/storefront/pull/128

Also filed:  Issue #129 — tests/cart.spec.ts:11 (AMBIGUOUS)
```

If nothing could be confidently healed, report the filed issues instead of a PR. The working tree is reported as **unchanged** in every case.

## GitHub delivery (PR or issue)

This skill **does not modify code in place.** Every fix is delivered through GitHub for review:

- **Tooling:** only the official `gh` CLI is used. The MCP `github-create_pull_request` tool is **never** invoked, and the driver does not fall back to it — `gh` gives complete, native GitHub coverage. Verify the active repo with `git status` / `git branch` before delivering.
- **PR for confident heals, issue for the rest** — the split is decided by `github-plan`; see the matrix in [`references/github-delivery.md`](references/github-delivery.md).
- **Custom endpoint & token:**
  - `GITHUB_TOKEN` — auth token. Exported to `GH_TOKEN` (and `GH_ENTERPRISE_TOKEN` when an enterprise host is in play). `gh` also reads `GITHUB_TOKEN` natively.
  - `GITHUB_BASE_API` — a custom API base such as `https://github.example.com/api/v3`. Its host is derived and exported as `GH_HOST` so `gh` targets the right server.
- **No silent edits:** the user's current branch and working tree are never mutated. Confident fixes live only on the heal branch / in the PR.

Full procedure, env handling, and the gh-enforcement rationale: [`references/github-delivery.md`](references/github-delivery.md).

## Edge cases

- **Multiple failing locators in one test** — confidently-healed ones are aggregated into a single PR; any that can't be resolved are filed as separate issues. A drift never blocks the others.
- **The element was actually removed** — score < threshold for every candidate; status `ELEMENT_REMOVED` → filed as an issue, never a PR.
- **The test depends on visual layout** (`.screenshot()` assertions) — heal the locator in the PR, and note in the PR body that the snapshot baseline may need refreshing separately.
- **Strict-mode duplicate match** — a replacement that would match >1 element is downgraded to an issue (with the candidate table) rather than emitting a risky `.nth()` / `.filter({ hasText: … })` locator.
- **Repo uses Playwright fixtures / POM objects** — if the locator lives in a Page Object file, the PR rewrites the POM, not the spec (the failing-locator record carries the owning file path).

## Test structure reference

To know *where* a drifted locator lives — inline spec, worker-scoped auth fixture, or Page Object — see [`references/test-structure.md`](references/test-structure.md). It documents the canonical suite layouts (minimal config + `tests/`, login-once-per-worker via `storageState`, screenshot-on-failure, POM) adapted from the upstream [`microsoft/playwright-test/examples`](https://github.com/microsoft/playwright-test/tree/master/examples), with the modern `@playwright/test` equivalents and a per-pattern note on which file the healer should rewrite.

## TypeScript package Initial Setup

The implementation lives at [`scripts/packages/ts/`](scripts/packages/ts/). Build it once with the setup script (resolves its own path, so it works from any directory):

```bash
./setup.sh            # install deps + build
./setup.sh --clean    # wipe dist/ + node_modules first, then rebuild
./setup.sh --check    # also verify the built CLI is runnable
```

Equivalent manual steps:

```bash
cd scripts/packages/ts && npm install && npm run build
```

Then the `cli.js` entry exposes: `classify`, `capture`, `fingerprint`, `match`, `rewrite`, `heal` (orchestrates the analysis), and `github-plan` (turns analysis into a PR/issue delivery plan). The `scripts/open-github.sh` driver consumes a plan and runs the `gh` commands.

See [`scripts/packages/ts/README.md`](scripts/packages/ts/README.md) for the full subcommand reference and [`references/github-delivery.md`](references/github-delivery.md) for the delivery flow.

## Testing the skill

A two-tier harness lives at [`.test-harness/`](.test-harness/) with labeled mock-DOM scenarios (class rename → PR, role/text rename → PR, element removed → issue, ambiguous duplicate → issue):

```bash
cd .test-harness
make fixtures   # deterministic: drives the CLI, scores vs ground truth (no API key)
make claude     # agentic: drives the real skill via the Claude Agent SDK (needs ANTHROPIC_API_KEY)
```

Both emit accuracy / PR-decision precision-recall metrics; the agentic tier also reports cost, turns, and skill-usage rate. See [`.test-harness/README.md`](.test-harness/README.md).
