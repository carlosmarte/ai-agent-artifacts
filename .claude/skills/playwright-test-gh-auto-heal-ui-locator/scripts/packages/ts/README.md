# @skills/playwright-ui-locator

TypeScript implementation that backs the [`playwright-ui-locator`](../../../SKILL.md) skill.

Given a failing Playwright test and the new DOM, this package fingerprints the original element, scores candidates in the new DOM, derives the most stable replacement Playwright locator (`getByTestId` / `getByRole` / `getByLabel` / `getByText` / id / data-attr / css), and turns the result into a **GitHub delivery plan** — a pull request for confident heals, an issue for the rest.

> This package does **not** modify the user's working tree as its end state. The `rewrite`
> primitive exists so the delivery driver can apply fixes on a dedicated branch; the skill's
> default path is `heal --dry-run` → `github-plan` → `../../open-github.sh`. See
> [`../../../references/github-delivery.md`](../../../references/github-delivery.md).

## Install & build

```bash
npm install
npm run build
```

Outputs are written to `dist/`. The CLI entry is `dist/cli.js`.

## CLI

```
pw-ui-locator <command> [flags]

classify    --report <playwright-json>
fingerprint --baseline <html> --selector <css>
match       --new <html> --selector <css> [--baseline <html>] [--threshold 0.75]
rewrite     --file <test.spec.ts> --api locator --old '.btn-primary' \
            --new "getByRole('button', { name: 'Place order' })" [--dry-run]
heal        --report <pw-json> --new-dom <html> [--baseline <html>] [--threshold 0.75] [--dry-run]
github-plan (--results <heal.json> | --report <pw-json> --new-dom <html> [--baseline <html>]) \
            [--out <dir>] [--repo <owner/repo>] [--base <branch>] [--branch-prefix <name>]
```

`github-plan` consumes a `HealResult[]` (or runs a dry-run heal itself) and writes PR/issue
artifacts (`pr-body.md`, `issue-N.md`, `plan.json`) to `--out`. It touches neither git, the
working tree, nor the network — the `../../open-github.sh` driver turns the plan into a PR
(confident heals) or issues (the rest) via the `gh` CLI.

### End-to-end example

```bash
# 1. Run the failing test once with the JSON reporter
npx playwright test tests/checkout.spec.ts --reporter=json > /tmp/pw.json || true

# 2. Re-run with trace and dump the page HTML at the moment of failure
npx playwright test tests/checkout.spec.ts --trace on || true
# (extract page.content() from trace; or capture via a one-shot dump script)

# 3. Analyze (dry-run — writes nothing) and build a GitHub delivery plan
node dist/cli.js github-plan \
  --report /tmp/pw.json \
  --new-dom /tmp/new-dom.html \
  --baseline /tmp/old-dom.html \
  --threshold 0.8 \
  --out ./.pw-heal-plan \
  --repo acme/storefront

# 4. Review, then deliver via the gh CLI
../../open-github.sh --plan ./.pw-heal-plan --plan-only        # review gate
../../open-github.sh --plan ./.pw-heal-plan --repo-dir /path/to/repo
```

`heal` itself (used internally by `github-plan`) exits non-zero if any failure could not be healed and prints a JSON array of `HealResult` objects (status, candidate scores, diff). Prefer `heal --dry-run` if you want the analysis without any file writes.

## Programmatic API

```ts
import { heal } from "@skills/playwright-ui-locator";

const results = await heal({
  reportPath: "/tmp/pw.json",
  newDomPath: "/tmp/new-dom.html",
  baselineDomPath: "/tmp/old-dom.html",
  threshold: 0.75,
});
```

Lower-level building blocks are also exported: `parsePlaywrightReport`, `classifyError`, `fingerprintFromElement`, `fingerprintFromSelector`, `findCandidates`, `deriveLocator`, `rewriteTest`, and `buildGithubPlan` (turns `HealResult[]` into the PR/issue artifacts consumed by `open-github.sh`).

## Scoring

See [`../../../references/scoring.md`](../../../references/scoring.md) for the candidate-match scoring matrix and tuning notes.

## Limitations

- Class-only selectors with no other context fingerprint poorly — supply `--baseline` for higher confidence.
- Shadow DOM is not pierced. JSDOM does not natively run scripts; capture the live `page.content()` instead.
- Tests using Page Object Models: rewrite the POM file, not the spec. Pass the POM path as `--file`.
- Visual-regression assertions (`toHaveScreenshot`) are not auto-healed; only locator calls are.
