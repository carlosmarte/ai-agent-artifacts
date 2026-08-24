from __future__ import annotations

import re

_VERSION_RE = re.compile(r"^(\d+)\.(\d+)\.(\d+)$")


def parse_range(spec) -> dict:
    if spec is None or spec == "":
        return {"op": "any"}
    s = str(spec).strip()
    if s.startswith("^"):
        m = _VERSION_RE.match(s[1:])
        if not m:
            raise ValueError(f"unparseable range: {spec}")
        M, mi, p = (int(x) for x in m.groups())
        return {"op": "caret", "min": [M, mi, p], "max_exclusive": [M + 1, 0, 0]}
    if s.startswith("~"):
        m = _VERSION_RE.match(s[1:])
        if not m:
            raise ValueError(f"unparseable range: {spec}")
        M, mi, p = (int(x) for x in m.groups())
        return {"op": "tilde", "min": [M, mi, p], "max_exclusive": [M, mi + 1, 0]}
    if _VERSION_RE.match(s):
        m = _VERSION_RE.match(s)
        M, mi, p = (int(x) for x in m.groups())
        return {"op": "exact", "min": [M, mi, p], "max_exclusive": [M, mi, p + 1]}
    lo = re.search(r">=\s*(\d+\.\d+\.\d+)", s)
    hi = re.search(r"<\s*(\d+\.\d+\.\d+)", s)
    if lo and hi:
        a = _VERSION_RE.match(lo.group(1)).groups()
        b = _VERSION_RE.match(hi.group(1)).groups()
        return {
            "op": "bounded",
            "min": [int(a[0]), int(a[1]), int(a[2])],
            "max_exclusive": [int(b[0]), int(b[1]), int(b[2])],
        }
    raise ValueError(f"unparseable range: {spec}")


def _cmp(a, b) -> int:
    for x, y in zip(a, b):
        if x != y:
            return x - y
    return 0


def intersects(a: dict, b: dict) -> bool:
    if a["op"] == "any" or b["op"] == "any":
        return True
    lo = a["min"] if _cmp(a["min"], b["min"]) > 0 else b["min"]
    hi = (
        a["max_exclusive"]
        if _cmp(a["max_exclusive"], b["max_exclusive"]) < 0
        else b["max_exclusive"]
    )
    return _cmp(lo, hi) < 0
