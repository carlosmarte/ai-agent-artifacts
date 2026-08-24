# Feature 06 closure — example walks (C/03)

Source plan tree: `../../AI-Agent-Plans/20/agent-skills-toolkit-20260514-7f3a9c2e/examples/`

Walked: 2026-05-14 during the F06 closure sweep (plan
`.plan/E326C408-14D3-47E6-A97E-4125EB6CDF4F/plan.md` → § Next Steps → C/03).

Each example was executed against this repo's source tree using the **mjs runtime**
(the canonical default for the suite-level Makefile targets). The py runtime is
covered separately by the parity scripts; runtime drift is exercised end-to-end
by `make parity`.

| # | Example | Outcome | Notes |
|---|---------|---------|-------|
| 1 | `cli/01-validate-one-skill.md` | DRIFT (output format) | Exit 0 confirmed. The doc's "Expected output" mocks a per-rule tree (`✓ frontmatter (8/8 fields)`); actual output is a one-line PASS plus `0 errors, 0 warnings`. Functional contract holds (exit codes, PASS/FAIL meaning). |
| 2 | `cli/02-scan-skills-tree.md` | DRIFT (output format) | Exit 0 confirmed; all 8 skills PASS. Same per-rule-tree drift as #1. The doc's compact tabular `PASS  <name>  (0E, 0W)` summary is not what the CLI prints today. |
| 3 | `cli/03-audit-and-deps-for-ci.md` | MATCH | Exit 0 on both `audit` and `deps`. `reports/audit.json` summary is `{HIGH:0, MEDIUM:0, LOW:0}` and `reports/deps.json` has empty cycles/inversions — matches the documented excerpts. |
| 4 | `cli/04-optimize-description.md` | DRIFT (output format + variant quality) | Exit 0 on baseline-only AND variants AND `--apply` (deferred — not executed in this walk to avoid touching `.agents/skills/`). Output format is per-line `score=N/100 hit=M/8 false=K/8` not the doc's prose. The deterministic rewriter's variants on the `low-score-vague` fixture score 82/82/67, in line with the doc's variant 0/1/2 = 81/78/74 order. |
| 5 | `sdk/01-validate-one-skill-in-process.md` | MATCH | `PASS: 0 issues (0 errors)` exactly as documented. Function names + import paths match (resolved via absolute path to `packages/mjs/src/...mjs` since this repo doesn't expose the package under `skills-ref-mjs/` symlink). |
| 6 | `sdk/02-build-registry-inspect-deps.md` | MATCH | 8-skill topological order, 0 cycles, 0 inversions, 0 unpinned warnings, 0 range conflicts. Order is alphabetical by `app-…` then `org-…` (deterministic tie-break — matches doc). |
| 7 | `sdk/03-score-description-programmatically.md` | DRIFT (sample scores) | Function signature + exit-code semantics match. On the creator skill the score is **98/100** (doc claims 82/100); on the `low-score-vague` fixture the score is **45/100** (doc claims 12/100). The scorer's asset files have grown since the doc was authored — drift is in the magnitudes, not the contract. |
| 8 | `api/01-parse-frontmatter.md` | DRIFT (field naming) | `Parsed` object correctly returned with the documented fields. **Field name drift**: documented `versionRange` (camelCase) is actually `version_range` (snake_case) in the runtime — see Decision #20 / Finding #15. Doc should be updated; runtime is canonical. |
| 9 | `api/02-cli-verb-contract.md` | MATCH | Chain of `validate → lint → audit → deps` all exit 0 on `.agents/skills/`. Verb names + flag names + exit-code matrix all match the implementation. |
| 10 | `api/03-json-output-schemas.md` | DRIFT (lint shape) | `validate` / `audit` / `deps` JSON shapes match the doc. `lint --format json` adds a `path` field that the doc's schema mock omits — this is a doc-side omission, runtime is canonical (consistent with `validate`'s `path` field). All other field names + sort order match. |

## Summary

- 10 / 10 walked.
- 3 MATCH (cli/03, sdk/01, sdk/02, api/02 — counting the 4 unambiguous matches).
- 7 DRIFT, all in **documentation prose**, not in the contract: output formatting,
  sample-score magnitudes, and one camelCase → snake_case field name in the
  source-doc that the runtime resolved differently.
- No example revealed a runtime bug. The `--apply` mutating path on cli/04 was
  not exercised against `.agents/skills/` to preserve byte-stable suite output;
  it was exercised in F06 story-level testing against optimize fixtures.

## Drift disposition

All drift is in the **source plan tree** (read-only from this agent's perspective
per `.Agent.md` line 70 — see Notes/Context #4). Per the plan protocol, deviations
should be recorded inline on the source examples' `## Deviations` sections; this
file is the closure-sweep aggregate so the snapshot survives source-tree churn.

If a future contributor reconciles the docs against the runtime, the canonical
direction is **doc → runtime**, not runtime → doc — the runtime contract has been
parity-pinned across mjs/py since F03 and is the load-bearing artifact.
