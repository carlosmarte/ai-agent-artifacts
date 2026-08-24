# Fixtures

This directory is the single source of truth for cross-runtime validator parity.
Both `packages/mjs/` and `packages/py/` consume these fixtures via relative path:
the mjs runtime resolves `../../../.agents/skills/agent-skill-kit-commons/fixtures/`,
the py runtime resolves the same path via `Path(__file__).parents[3] / ".agents" / "skills" / "agent-skill-kit-commons" / "fixtures"`,
each relative to its own package root.

## Layout

- `valid/<case>/SKILL.md` — fixtures that must produce `status: PASS` and exit 0.
- `invalid/<case>/SKILL.md` — fixtures that must produce `status: FAIL` and exit non-zero.
- `parsed/cases/<case>/SKILL.md` + `parsed/expected/<case>.json` — frontmatter parser snapshots.
- `naming/<case>/SKILL.md` + `naming/expected/<case>.issues.json` — naming-rule snapshots.
- `deps/<case>/` — dependency-graph cases (Feature 03).
- `lint/<case>/` — discoverability-linter cases (Feature 04).
- `prompt/<case>/` — prompt-emitter cases (Feature 05).
- `properties/<case>/` — read-properties cases (Feature 05).

The directory name MUST equal the frontmatter `name:` of the fixture's SKILL.md
(spec §3.1 directory-match rule). Cases that exist to break that rule live under `invalid/`.
