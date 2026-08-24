---
name: passing-clean
description: Naming fixture that satisfies every E-rule in the naming table (name matches dir, single-hyphen-separated lowercase, valid tier, description in-bounds). Used as the "no issues" snapshot.
tier: org
---

Body content for the passing-clean naming fixture. Length is irrelevant for the naming
snapshot; the load-bearing artifact is `fixtures/naming/expected/passing-clean.json`,
which must remain the literal empty-list `[]` so any future regression that emits a
spurious issue against a clean fixture trips the parity diff.
