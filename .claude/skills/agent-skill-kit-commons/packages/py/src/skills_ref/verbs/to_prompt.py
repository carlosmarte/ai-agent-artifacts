from __future__ import annotations

from pathlib import Path

from ..registry import build_registry
from ..deps.toposort import topo_sort, find_missing_targets
from ..prompt.xml import serialize_available_skills
from ..prompt.budget import truncate_to_budget


def to_prompt(args) -> tuple[int, str]:
    path = Path(args.path).resolve()
    if not path.exists():
        return 2, f"no SKILL.md found under: {args.path}\n"
    reg = build_registry(str(path))
    if not reg.nodes:
        return 2, f"no SKILL.md found under: {args.path}\n"
    topo = topo_sort(reg)
    order = topo["order"]
    cycles = topo["cycles"]
    if cycles:
        msg = "\n".join("cycle: " + " -> ".join(c) for c in cycles)
        return 1, msg + "\n"
    missing = find_missing_targets(reg)
    if missing:
        msg = "\n".join(
            f"missing in-repo dep: {m['from']} -> {m['to']}" for m in missing
        )
        return 1, msg + "\n"

    include_invalid = bool(getattr(args, "include_invalid", False))
    max_tokens = getattr(args, "max_tokens", None)

    entries: list[dict] = []
    for name in order:
        node = reg.nodes.get(name)
        if not node:
            continue
        if node.get("parse_error"):
            if include_invalid:
                entries.append(
                    {
                        "name": name,
                        "tier": "",
                        "description": node["parse_error"],
                        "invalid": True,
                    }
                )
            continue
        entries.append(
            {
                "name": node.get("name") or name,
                "tier": node.get("tier") or "",
                "description": node.get("description") or "",
            }
        )
    if include_invalid:
        seen = set(order)
        for name, node in reg.nodes.items():
            if name in seen:
                continue
            if not node.get("parse_error"):
                continue
            entries.append(
                {
                    "name": name,
                    "tier": "",
                    "description": node["parse_error"],
                    "invalid": True,
                }
            )

    kept, dropped = truncate_to_budget(entries, max_tokens)
    xml = serialize_available_skills(kept, truncated=dropped)
    return 0, xml
