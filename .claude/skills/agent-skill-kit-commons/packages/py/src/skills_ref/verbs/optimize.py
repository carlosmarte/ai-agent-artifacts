from __future__ import annotations

import json
from pathlib import Path

from ..optimize.apply import apply_variant, commit, rollback
from ..optimize.orchestrator import optimize as _optimize
from .validate import validate as _validate


def _sort(v):
    if isinstance(v, list):
        return [_sort(x) for x in v]
    if isinstance(v, dict):
        return {k: _sort(v[k]) for k in sorted(v.keys())}
    return v


def _format_human(report: dict) -> str:
    lines = [report["path"], f"  provider: {report['provider']}"]
    b = report["baseline"]
    hr = b["hit_rate"]
    lines.append(
        f"  baseline: score={b['score']}/100 hit={hr['positive_hits']}/{hr['positive_total']} false={hr['false_positives']}/{hr['false_total']}"
    )
    if report["variants"]:
        lines.append("  variants:")
        for i, v in enumerate(report["variants"]):
            vh = v["hit_rate"]
            lines.append(
                f"    [{i}] score={v['score']}/100 hit={vh['positive_hits']}/{vh['positive_total']} false={vh['false_positives']}/{vh['false_total']}"
            )
            lines.append(f"        rationale: {v['rationale']}")
            lines.append(f"        text: {v['text']}")
    return "\n".join(lines) + "\n"


class _Ns:
    def __init__(self, path, fmt, extra_tiers, no_color=False, strict=False):
        self.path = path
        self.format = fmt
        self.extra_tiers = extra_tiers
        self.no_color = no_color
        self.strict = strict


def optimize(args) -> tuple[int, str]:
    target = Path(args.path)
    if not target.exists():
        return 2, f"no SKILL.md found under: {args.path}\n"
    if not target.is_dir():
        return 2, f"not a directory: {args.path}\n"
    if not (target / "SKILL.md").is_file():
        return 2, f"no SKILL.md found under: {args.path}\n"

    try:
        report = _optimize(
            str(target.resolve()),
            {
                "baseline_only": bool(getattr(args, "baseline_only", False)),
                "query_count": int(getattr(args, "query_count", 8) or 8),
            },
        )
    except Exception as e:
        return 1, f"optimize: {e}\n"

    apply_idx = getattr(args, "apply", None)
    if apply_idx is not None:
        if apply_idx < 0 or apply_idx >= len(report["variants"]):
            return (
                64,
                f"--apply {apply_idx}: variant index out of range (have {len(report['variants'])})\n",
            )
        variant = report["variants"][apply_idx]
        try:
            res = apply_variant(str(target.resolve()), variant)
        except Exception as e:
            return 1, f"optimize --apply: {e}\n"
        backup = res["backup"]
        v_args = _Ns(
            path=str(target.resolve()),
            fmt="json",
            extra_tiers="company,enterprise,application",
        )
        exit_code, _ = _validate(v_args)
        if exit_code != 0:
            rollback(str(target.resolve()), backup)
            return (
                1,
                f"optimize --apply {apply_idx}: post-write validation failed; original restored.\n",
            )
        commit(backup)
        return 0, f"optimize --apply {apply_idx}: wrote variant; validation OK.\n"

    if args.format == "json":
        return 0, json.dumps(_sort(report), separators=(",", ":")) + "\n"
    return 0, _format_human(report)
