# Test harness — `playwright-ui-locator` skill

Two complementary tiers prove the skill works and quantify how well, using a shared
set of labeled mock-DOM scenarios. Both compute **performance metrics** (accuracy,
precision/recall, and — for the agentic tier — cost/turns/latency).

```
.test-harness/
├── fixtures/                 # labeled scenarios (the ground truth)
│   ├── a-testid-class-rename/   class rename, testid survives   → HEALED → PR
│   ├── b-role-text-rename/      class rename, role+text only    → HEALED → PR
│   ├── c-element-removed/       element deleted                 → ELEMENT_REMOVED → issue
│   └── d-ambiguous-duplicate/   two identical candidates        → AMBIGUOUS → issue
├── run-fixtures.mjs          # Tier 1 — deterministic (no API key)
├── claude/run-skill.mjs      # Tier 2 — agentic (Claude Agent SDK)
├── Makefile
└── metrics/                  # JSON metric reports (gitignored)
```

## Quick start

```bash
# from this directory
make build       # build the skill's TS package once
make fixtures    # Tier 1: fast deterministic check + metrics
make claude      # Tier 2: agentic check (needs ANTHROPIC_API_KEY + npm install)
make all         # build + fixtures (+ claude if a key is set)
```

## Each scenario

A scenario directory is fully self-contained and path-free:

| File | Role |
| --- | --- |
| `baseline.html` | the old DOM (where the original locator resolved) |
| `new.html` | the current DOM after the UI change |
| `spec.ts` | the failing Playwright test (carries the broken locator) |
| `scenario.json` | the **label**: failing selector, error text, threshold, and the expected `{ status, delivery, locator }` |

The runners synthesize a Playwright JSON report from `scenario.json` at run time
(pointing at a throwaway copy of `spec.ts`), so no host-specific paths are baked in.

## Tier 1 — deterministic (`run-fixtures.mjs`)

The fast regression gate. For each scenario it drives the skill's own CLI
(`cli.js github-plan`, which runs a dry-run heal then splits PR-vs-issue) and compares
`plan.json` to the label. No network, no API key, sub-second.

```
$ make fixtures

  scenario                thr   expect                  actual                  result
  ------------------------------------------------------------------------------------
  a-testid-class-rename   0.75  HEALED/pr               HEALED/pr               ✓ PASS
  b-role-text-rename      0.45  HEALED/pr               HEALED/pr               ✓ PASS
  c-element-removed       0.45  ELEMENT_REMOVED/issue   ELEMENT_REMOVED/issue   ✓ PASS
  d-ambiguous-duplicate   0.45  AMBIGUOUS/issue         AMBIGUOUS/issue         ✓ PASS

  Metrics
    overall accuracy    100.0%  (4/4 scenarios fully correct)
    status accuracy     100.0%
    delivery accuracy   100.0%  (PR vs issue routing)
    locator accuracy    100.0%  (exact derived locator)
    PR-decision         precision 100.0%  recall 100.0%  f1 100.0%
                        tp=2 fp=0 tn=2 fn=0
```

**Metrics:**
- **overall accuracy** — fraction of scenarios where status *and* delivery *and* locator all match.
- **status / delivery / locator accuracy** — per-dimension breakdown.
- **PR-decision precision/recall/F1** — treats "should open a PR" as the positive class. Precision guards against *over-eager PRs* (filing a PR when the case is actually ambiguous); recall guards against *missed heals* (filing an issue when a clean fix existed).

Exit code is non-zero if any scenario fails, so it doubles as a CI gate.

## Tier 2 — agentic (`claude/run-skill.mjs`)

Proves the *end-to-end skill*, not just the package: it loads `SKILL.md` + `references/`
through the **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`) and asks the agent to
heal each scenario. The skill is made discoverable by symlinking it into a per-scenario
`workspace/.claude/skills/playwright-ui-locator/` and running `query()` with
`settingSources: ["project"]`, `skills: "all"`, and `cwd` set to that workspace.

The agent is told **not** to touch GitHub (no remote in the sandbox) — it runs the analysis
+ `github-plan` and emits a final `json` block `{ status, delivery, locator }`, which is
scored against the same labels.

```bash
export ANTHROPIC_API_KEY=sk-...
make claude
#   node claude/run-skill.mjs [--model <id>] [--only a-testid-class-rename] [--max-turns N]
```

It **skips gracefully** (exit 0) when `ANTHROPIC_API_KEY` is unset or the SDK isn't installed.

Extra metrics on top of the Tier-1 set:
- **skill-usage rate** — did the agent actually invoke the skill's CLI (vs. answering from prior knowledge)? Evidence that the skill, not the base model, drove the result.
- **cost (USD), avg turns, avg latency, tokens in/out** — the performance budget per heal.

## A note on the confidence threshold

The package normalizes a candidate's score against a fixed `MAX_SCORE = 305` (the sum of all
signal weights). In practice a strong **non-testid** match (text + role + ancestor + tag) tops
out around `0.49`, while a `data-testid`-anchored match reaches `0.82+`. That is why the
fixtures set a **per-scenario threshold**: scenario A (testid present) is checked at the
default `0.75`, while the role/text-only scenario B uses `0.45`. This is a deliberate,
documented property of the current scoring — surfaced here so the metric is honest rather
than tuned to hide it. If the skill's weights or normalization change, these fixtures will
flag the behavioral shift.

## Adding a scenario

1. `mkdir fixtures/e-my-case` with `baseline.html`, `new.html`, `spec.ts`.
2. Write `scenario.json` (copy an existing one; set `failing`, `errorMessage` — it **must**
   contain `page.<api>('<selector>')` so the report parser extracts it — `threshold`, and the
   `expected` label).
3. `make fixtures` (and `make claude` if you have a key). Both runners auto-discover it.
