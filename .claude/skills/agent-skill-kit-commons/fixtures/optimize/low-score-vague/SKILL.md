---
name: low-score-vague
description: A useful tool that helps with stuff related to skills and is generally helpful for many things.
tier: org
---

# low-score-vague

This skill is a fixture used by the optimizer's parity harness to exercise the variant-improvement path. The body deliberately mentions multiple actionable verbs and nouns — scaffold, validate, audit, score, emit, generate, resolve, lint, optimize — so the deterministic query generator has enough vocabulary to build positive trigger queries.

The frontmatter description is intentionally vague (uses banned phrases like "useful for", "helps with", "general purpose") so the optimizer can propose variants that strip the vagueness and lead with an action verb. The expected behavior is that at least one variant scores meaningfully higher than the baseline on the F04 description scorer.
