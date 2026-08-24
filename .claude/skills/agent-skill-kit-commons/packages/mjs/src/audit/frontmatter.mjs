const ALLOWED_TOP_LEVEL = new Set([
  "name",
  "description",
  "tier",
  "license",
  "compatibility",
  "metadata",
  "allowed-tools",
  "dependencies",
]);

/**
 * Flag any top-level frontmatter key that is not on the spec allowlist.
 * Emit MEDIUM A001_UNAUTHORIZED_FIELD per offender. Recommends 'metadata'.
 */
export function auditFrontmatter(registry) {
  const findings = [];
  for (const [, node] of registry.nodes) {
    if (node.parse_error) continue;
    const raw = node.raw_frontmatter;
    if (!raw || typeof raw !== "object") continue;
    const keys = Object.keys(raw).sort();
    for (const key of keys) {
      if (!ALLOWED_TOP_LEVEL.has(key)) {
        findings.push({
          severity: "MEDIUM",
          code: "A001_UNAUTHORIZED_FIELD",
          where: `${node.dir}/SKILL.md:${key}`,
          message: `unauthorized top-level frontmatter field '${key}'; move under 'metadata' to preserve vendor-neutrality`,
        });
      }
    }
  }
  return findings;
}
