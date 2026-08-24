from __future__ import annotations

import json
from pathlib import Path

from ..lint import lint as _lint
from ..parser import (
    MalformedFrontmatterError,
    MissingFrontmatterError,
    parse_frontmatter,
)


_EMPTY_BREAKDOWN = {
    "keywordDensity": 0,
    "actionVerbs": 0,
    "triggerPhrases": 0,
    "specificity": 0,
    "length": 0,
}


def _discover_skills(target: Path) -> list[Path]:
    if target.is_file():
        if target.name == "SKILL.md":
            return [target.parent]
        return []
    direct = target / "SKILL.md"
    if direct.is_file():
        return [target]
    out: list[Path] = []
    for entry in sorted(target.iterdir(), key=lambda p: p.name):
        if not entry.is_dir():
            continue
        if entry.name.startswith("."):
            continue
        out.extend(_discover_skills(entry))
    return out


def _sort(v):
    if isinstance(v, list):
        return [_sort(x) for x in v]
    if isinstance(v, dict):
        return {k: _sort(v[k]) for k in sorted(v.keys())}
    return v


def _lint_one(skill_dir: Path) -> dict:
    skill_path = skill_dir / "SKILL.md"
    try:
        text = skill_path.read_text(encoding="utf-8")
    except OSError as e:
        return {
            "path": str(skill_path),
            "score": 0,
            "breakdown": dict(_EMPTY_BREAKDOWN),
            "issues": [
                {
                    "code": "E100_SKILL_MD_MISSING",
                    "severity": "error",
                    "field": "skill",
                    "message": f"SKILL.md not readable: {e}",
                }
            ],
        }
    try:
        parsed = parse_frontmatter(text)
    except MissingFrontmatterError as e:
        return {
            "path": str(skill_path),
            "score": 0,
            "breakdown": dict(_EMPTY_BREAKDOWN),
            "issues": [
                {
                    "code": "E101_FRONTMATTER_MISSING",
                    "severity": "error",
                    "field": "frontmatter",
                    "message": str(e),
                }
            ],
        }
    except MalformedFrontmatterError as e:
        return {
            "path": str(skill_path),
            "score": 0,
            "breakdown": dict(_EMPTY_BREAKDOWN),
            "issues": [
                {
                    "code": "E102_FRONTMATTER_MALFORMED",
                    "severity": "error",
                    "field": "frontmatter",
                    "message": str(e),
                }
            ],
        }
    r = _lint(parsed, str(skill_dir))
    return {
        "path": str(skill_path),
        "score": r["score"],
        "breakdown": r["breakdown"],
        "issues": r["issues"],
    }


def _exit_code_for(report: dict, min_score: int) -> int:
    if any(i.get("severity") == "error" for i in report["issues"]):
        return 1
    if any(i.get("code") == "W002_BROKEN_REFERENCE" for i in report["issues"]):
        return 1
    if report["score"] < min_score:
        return 1
    return 0


def _format_human(report: dict, explain: bool, min_score: int) -> str:
    lines: list[str] = []
    status = "OK" if _exit_code_for(report, min_score) == 0 else "FAIL"
    lines.append(report["path"])
    lines.append(f"  discoverability: {report['score']}/100 [{status}]")
    if explain:
        b = report["breakdown"]
        lines.append(
            "  sub-scores: "
            f"keyword={b['keywordDensity']}/25 "
            f"verbs={b['actionVerbs']}/20 "
            f"trigger={b['triggerPhrases']}/20 "
            f"specificity={b['specificity']}/20 "
            f"length={b['length']}/15"
        )
    for i in report["issues"]:
        lines.append(f"  [{i['severity']}] {i['code']}: {i['message']}")
    return "\n".join(lines) + "\n"


def lint(args) -> tuple[int, str]:
    path = Path(args.path).resolve()
    if not path.exists():
        return 1, f"no SKILL.md found under: {args.path}\n"
    skills = _discover_skills(path)
    if not skills:
        return 1, f"no SKILL.md found under: {args.path}\n"
    min_score = int(getattr(args, "min_score", 40) or 40)
    explain = bool(getattr(args, "explain", False))
    reports = [_lint_one(d) for d in skills]
    exit_code = 0
    for r in reports:
        if _exit_code_for(r, min_score) == 1:
            exit_code = 1
    if args.format == "json":
        if len(reports) == 1:
            payload = _sort(
                {
                    "score": reports[0]["score"],
                    "breakdown": reports[0]["breakdown"],
                    "issues": reports[0]["issues"],
                    "path": reports[0]["path"],
                }
            )
        else:
            payload = _sort(
                {
                    "reports": [
                        {
                            "path": r["path"],
                            "score": r["score"],
                            "breakdown": r["breakdown"],
                            "issues": r["issues"],
                        }
                        for r in reports
                    ]
                }
            )
        return exit_code, json.dumps(payload, separators=(",", ":")) + "\n"
    out = "".join(_format_human(r, explain, min_score) for r in reports)
    return exit_code, out
