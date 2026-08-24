from __future__ import annotations

import json


def format_audit(findings, fmt: str = "human") -> str:
    counts = {"HIGH": 0, "MEDIUM": 0, "LOW": 0}
    for f in findings:
        if f.get("severity") in counts:
            counts[f["severity"]] += 1
    if fmt == "json":
        out = {"summary": counts, "findings": findings}
        return json.dumps(_sort(out), sort_keys=True, separators=(",", ":")) + "\n"
    parts = []
    for sev in ("HIGH", "MEDIUM", "LOW"):
        for f in findings:
            if f.get("severity") != sev:
                continue
            parts.append(f"[{sev}] {f['code']} {f['where']}: {f['message']}\n")
    parts.append(
        f"\nsummary: {counts['HIGH']} HIGH, {counts['MEDIUM']} MEDIUM, {counts['LOW']} LOW\n"
    )
    return "".join(parts)


def _sort(v):
    if isinstance(v, list):
        return [_sort(x) for x in v]
    if isinstance(v, dict):
        return {k: _sort(v[k]) for k in sorted(v.keys())}
    return v
