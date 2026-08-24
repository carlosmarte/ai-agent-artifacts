---
name: app-parsed-optional
description: Parser fixture exercising every optional frontmatter field (license, compatibility, metadata, allowed-tools, dependencies) so the canonical-JSON snapshot pins their representation across runtimes.
tier: app
license: Apache-2.0
compatibility: needs git and python>=3.11
metadata:
  author: closure-sweep
  version: "0.0.1"
allowed-tools:
  - Read
  - Bash
dependencies:
  - org-parsed-minimal@^1.0.0
  - acme/governance#security-baseline@~2.1
---

Body paragraph one. Optional-fields fixture for parser parity. The expected snapshot
exercises license, compatibility, metadata (mapping), allowed-tools (list), and
dependencies (mix of in-repo + cross-repo) — all five optional carriers in one file.
