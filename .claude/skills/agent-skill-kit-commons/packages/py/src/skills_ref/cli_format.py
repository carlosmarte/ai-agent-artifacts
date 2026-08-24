from __future__ import annotations

import json


def _sort(v):
    if isinstance(v, list):
        return [_sort(x) for x in v]
    if isinstance(v, dict):
        return {k: _sort(v[k]) for k in sorted(v.keys())}
    return v


def format_json(report) -> str:
    if hasattr(report, "to_dict"):
        report = report.to_dict()
    return json.dumps(_sort(report), separators=(",", ":")) + "\n"


def format_human(report, color: bool = True) -> str:
    if hasattr(report, "to_dict"):
        report = report.to_dict()
    if color:
        def red(s): return f"\x1b[31m{s}\x1b[0m"

        def yellow(s): return f"\x1b[33m{s}\x1b[0m"

        def green(s): return f"\x1b[32m{s}\x1b[0m"

        def dim(s): return f"\x1b[2m{s}\x1b[0m"
    else:
        def red(s): return s
        def yellow(s): return s
        def green(s): return s
        def dim(s): return s

    lines = []
    status = report["status"]
    tag = green("PASS") if status == "PASS" else yellow("WARN") if status == "WARN" else red("FAIL")
    lines.append(f"{tag} {report['path']}")
    for i in report["issues"]:
        icon = red("error") if i["severity"] == "error" else yellow("warn")
        lines.append(f"  {icon} [{i['code']}] {i['field']}: {i['message']}")
    summary = report["summary"]
    lines.append(
        dim(f"  {summary['errors']} errors, {summary['warnings']} warnings")
    )
    return "\n".join(lines) + "\n"
