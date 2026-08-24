/**
 * Tier-rank table. A skill at rank R may depend only on skills at rank <= R.
 * Spec tiers: org / team / app / project.
 * Extended tiers (only meaningful when --extra-tiers is on): company, enterprise, application.
 */
export const TIER_RANK = {
  org: 0,
  team: 1,
  app: 2,
  project: 3,
  // extended
  company: -2,
  enterprise: -1,
  application: 2,
};

export function checkInversions(registry) {
  const inversions = [];
  for (const [name, deps] of registry.edges) {
    const fromNode = registry.nodes.get(name);
    if (!fromNode || !fromNode.tier) continue;
    const fromRank = TIER_RANK[fromNode.tier];
    if (fromRank === undefined) continue;
    for (const dep of deps) {
      if (dep.origin !== "in_repo") continue;
      const toNode = registry.nodes.get(dep.name);
      if (!toNode || !toNode.tier) continue;
      const toRank = TIER_RANK[toNode.tier];
      if (toRank === undefined) continue;
      if (toRank > fromRank) {
        inversions.push({
          from: name,
          to: dep.name,
          fromTier: fromNode.tier,
          toTier: toNode.tier,
        });
      }
    }
  }
  return inversions;
}
