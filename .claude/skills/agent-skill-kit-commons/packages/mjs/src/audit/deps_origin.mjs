/**
 * Cross-repo dependency owner scan.
 *   - With no allowlist:   MEDIUM A020_UNVETTED_ORIGIN (advisory).
 *   - With allowlist set:  HIGH A020_UNVETTED_ORIGIN when owner not in list.
 */
export function auditDepOrigins(registry, { allowedOrigins } = {}) {
  const findings = [];
  const allowSet =
    Array.isArray(allowedOrigins) && allowedOrigins.length > 0
      ? new Set(allowedOrigins)
      : null;
  for (const [name, deps] of registry.edges) {
    for (const dep of deps) {
      if (dep.origin !== "cross_repo") continue;
      const owner = dep.owner ?? "";
      if (!allowSet) {
        findings.push({
          severity: "MEDIUM",
          code: "A020_UNVETTED_ORIGIN",
          where: `${name}:dependencies`,
          message: `cross-repo dependency '${owner}/${dep.repo}#${dep.name}' has no allowlist (run with --allowed-origins to enforce)`,
        });
      } else if (!allowSet.has(owner)) {
        findings.push({
          severity: "HIGH",
          code: "A020_UNVETTED_ORIGIN",
          where: `${name}:dependencies`,
          message: `cross-repo dependency owner '${owner}' not in --allowed-origins`,
        });
      }
    }
  }
  return findings;
}
