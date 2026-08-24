---
name: prompt-fix-b
description: Fixture skill B — depends on prompt-fix-a, sits second in topological order; trivial body for parity tests.
tier: org
dependencies:
  - prompt-fix-a
---

# prompt-fix-b

Depends on A. Used to exercise dep-first topological emission.
