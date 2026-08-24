from __future__ import annotations

import json
import sys

from skills_ref.lint.scorer import score_description


def _sort(v):
    if isinstance(v, list):
        return [_sort(x) for x in v]
    if isinstance(v, dict):
        return {k: _sort(v[k]) for k in sorted(v.keys())}
    return v


def main() -> int:
    if len(sys.argv) < 2:
        sys.stderr.write("usage: dump-score <descriptions.json>\n")
        return 64
    cases = json.loads(open(sys.argv[1], encoding="utf-8").read())
    out: dict = {}
    for c in cases:
        r = score_description(c["description"], c["body"])
        out[c["id"]] = {"score": r["score"], "breakdown": r["breakdown"]}
    sys.stdout.write(
        json.dumps(_sort(out), indent=2, separators=(",", ": ")) + "\n"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
