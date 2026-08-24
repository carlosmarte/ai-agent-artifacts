from __future__ import annotations

import json
from pathlib import Path

from ..deps.conflict import check_conflicts, check_unpinned
from ..deps.inversion import check_inversions
from ..deps.toposort import find_missing_targets, topo_sort
from ..registry import build_registry


def deps(args) -> tuple[int, str]:
    root = Path(args.path).resolve()
    reg = build_registry(str(root))
    ts = topo_sort(reg)
    order = ts["order"]
    cycles = ts["cycles"]
    missing = find_missing_targets(reg)
    inversions = check_inversions(reg)
    conflicts = check_conflicts(reg)
    unpinned = check_unpinned(reg)

    exit_code = 0
    if cycles or inversions:
        exit_code = 1
    elif missing:
        exit_code = 2
    elif conflicts:
        exit_code = 1
    elif getattr(args, "strict", False) and unpinned:
        exit_code = 2

    if args.format == "json":
        body = {
            "order": order,
            "cycles": cycles,
            "missing": missing,
            "inversions": inversions,
            "conflicts": conflicts,
            "unpinned": unpinned,
            "warnings": list(reg.warnings),
        }
        return exit_code, json.dumps(_sort(body), sort_keys=True, separators=(",", ":")) + "\n"

    parts = []
    parts.append(f"order: {' -> '.join(order) if order else '(empty)'}\n")
    if cycles:
        parts.append("cycles:\n")
        for c in cycles:
            parts.append(f"  - {' -> '.join(c)}\n")
    if missing:
        parts.append("missing in-repo targets:\n")
        for m in missing:
            parts.append(f"  - {m['from']} -> {m['to']}\n")
    if inversions:
        parts.append("inversions:\n")
        for i in inversions:
            parts.append(
                f"  - {i['from']} ({i['fromTier']}) -> {i['to']} ({i['toTier']}) "
                f"[downward dependency forbidden]\n"
            )
    if conflicts:
        parts.append("conflicts:\n")
        for c in conflicts:
            parts.append(f"  - {c['message']}\n")
    if unpinned:
        parts.append("unpinned (WARN):\n")
        for u in unpinned:
            parts.append(f"  - {u['message']}\n")
    if reg.warnings:
        parts.append("registry warnings:\n")
        for w in reg.warnings:
            parts.append(f"  - {w}\n")
    parts.append(
        f"\nsummary: {len(cycles)} cycle(s), {len(inversions)} inversion(s), "
        f"{len(missing)} missing, {len(conflicts)} conflict(s), {len(unpinned)} unpinned\n"
    )
    return exit_code, "".join(parts)


def _sort(v):
    if isinstance(v, list):
        return [_sort(x) for x in v]
    if isinstance(v, dict):
        return {k: _sort(v[k]) for k in sorted(v.keys())}
    return v
