from __future__ import annotations

import argparse
import json
import sys

from ..deps.conflict import check_conflicts, check_unpinned
from ..deps.inversion import check_inversions
from ..deps.toposort import find_missing_targets, topo_sort
from ..registry import build_registry


def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog="dump-deps")
    p.add_argument("root")
    args = p.parse_args(argv)
    reg = build_registry(args.root)
    ts = topo_sort(reg)
    out = {
        "order": ts["order"],
        "cycles": ts["cycles"],
        "missing": find_missing_targets(reg),
        "inversions": check_inversions(reg),
        "conflicts": check_conflicts(reg),
        "unpinned": check_unpinned(reg),
    }
    sys.stdout.write(json.dumps(_sort(out), sort_keys=True, separators=(",", ":")) + "\n")
    return 0


def _sort(v):
    if isinstance(v, list):
        return [_sort(x) for x in v]
    if isinstance(v, dict):
        return {k: _sort(v[k]) for k in sorted(v.keys())}
    return v


if __name__ == "__main__":
    sys.exit(main())
