import { parseRange, intersects } from "./range.mjs";

/**
 * For each in-repo dependency name, collect every (caller, range) pair.
 * If any two ranges fail `intersects`, emit E020_CONFLICTING_RANGES.
 * Issues are returned in deterministic order (sorted by message).
 */
export function checkConflicts(registry) {
  const grouped = new Map();
  // Iterate edges in sorted-by-caller order; registry already returns a sorted Map.
  for (const [caller, deps] of registry.edges) {
    for (const dep of deps) {
      if (dep.origin !== "in_repo" || !dep.version_range) continue;
      const arr = grouped.get(dep.name) ?? [];
      arr.push({
        caller,
        rangeStr: dep.version_range,
        range: parseRange(dep.version_range),
      });
      grouped.set(dep.name, arr);
    }
  }
  const issues = [];
  // Sort group iteration for determinism
  const groups = [...grouped.entries()].sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  for (const [depName, callers] of groups) {
    for (let i = 0; i < callers.length; i++) {
      for (let j = i + 1; j < callers.length; j++) {
        if (!intersects(callers[i].range, callers[j].range)) {
          issues.push({
            code: "E020_CONFLICTING_RANGES",
            severity: "error",
            field: "dependencies",
            message: `incompatible ranges for '${depName}': ${callers[i].caller} requires ${callers[i].rangeStr}, ${callers[j].caller} requires ${callers[j].rangeStr}`,
          });
        }
      }
    }
  }
  return issues;
}

/**
 * Emit W020_UNPINNED_DEPENDENCY for each in-repo dep that has no version range.
 */
export function checkUnpinned(registry) {
  const issues = [];
  for (const [caller, deps] of registry.edges) {
    for (const dep of deps) {
      if (dep.origin === "in_repo" && !dep.version_range) {
        issues.push({
          code: "W020_UNPINNED_DEPENDENCY",
          severity: "warn",
          field: "dependencies",
          message: `${caller}: unpinned dependency '${dep.name}'; pin against tag '${dep.name}/v<X.Y.Z>'`,
        });
      }
    }
  }
  return issues;
}
