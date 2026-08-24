---
name: org-mismatched-name
description: Naming fixture whose frontmatter name does not match its parent directory (dir is `dir-name-mismatch`, name is `org-mismatched-name`). Drives E005_NAME_DIRECTORY_MISMATCH.
tier: org
---

Body content. This fixture exists solely to lock the error-emitting path of the
naming checker — exactly one issue (E005) is expected in the frozen snapshot, with
field=`name` and severity=`error`.
