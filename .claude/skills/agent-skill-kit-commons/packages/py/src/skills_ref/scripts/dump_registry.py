from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from ..registry import build_registry


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="dump-registry")
    parser.add_argument("root")
    args = parser.parse_args(argv)
    reg = build_registry(args.root)
    nodes = {}
    for k, v in reg.nodes.items():
        nodes[k] = {
            "name": v.get("name") or k,
            "dir_basename": Path(v["dir"]).name if v.get("dir") else None,
            "parse_error": v.get("parse_error"),
            "tier": v.get("tier"),
        }
    edges = {}
    for k, deps in reg.edges.items():
        edges[k] = [
            {
                "name": d.name,
                "version_range": d.version_range,
                "origin": d.origin,
                "owner": d.owner,
                "repo": d.repo,
            }
            for d in (deps or [])
        ]
    out = {
        "nodes": _sort(nodes),
        "edges": _sort(edges),
        "warnings": list(reg.warnings),
    }
    sys.stdout.write(json.dumps(out, sort_keys=True, separators=(",", ":")) + "\n")
    return 0


def _sort(v):
    if isinstance(v, list):
        return [_sort(x) for x in v]
    if isinstance(v, dict):
        return {k: _sort(v[k]) for k in sorted(v.keys())}
    return v


if __name__ == "__main__":
    sys.exit(main())
