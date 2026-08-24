from __future__ import annotations

TIER_RANK = {
    "org": 0,
    "team": 1,
    "app": 2,
    "project": 3,
    # extended
    "company": -2,
    "enterprise": -1,
    "application": 2,
}


def check_inversions(registry) -> list:
    inversions = []
    for name, deps in registry.edges.items():
        from_node = registry.nodes.get(name)
        if not from_node or not from_node.get("tier"):
            continue
        from_rank = TIER_RANK.get(from_node["tier"])
        if from_rank is None:
            continue
        for dep in deps:
            if dep.origin != "in_repo":
                continue
            to_node = registry.nodes.get(dep.name)
            if not to_node or not to_node.get("tier"):
                continue
            to_rank = TIER_RANK.get(to_node["tier"])
            if to_rank is None:
                continue
            if to_rank > from_rank:
                inversions.append({
                    "from": name,
                    "to": dep.name,
                    "fromTier": from_node["tier"],
                    "toTier": to_node["tier"],
                })
    return inversions
