---
name: malformed
description: This skill is intentionally malformed — the frontmatter has no closing delimiter so the parser throws MissingFrontmatterError.
tier: org

# malformed

No closing `---` above. Used by parity-read-properties.sh to verify the exit-1 (parse-failure) branch in both runtimes.
