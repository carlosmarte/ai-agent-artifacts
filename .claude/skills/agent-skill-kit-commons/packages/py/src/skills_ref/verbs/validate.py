from __future__ import annotations

from pathlib import Path

from ..cli_format import format_human, format_json
from ..parser import (
    MalformedFrontmatterError,
    MissingFrontmatterError,
    parse_frontmatter,
)
from ..rules.body import check_body
from ..rules.naming import check_naming
from ..rules.optional_dirs import check_optional_dirs
from ..rules.references import check_references
from ..types import Issue, Report


def _discover(target: Path) -> list[Path]:
    if target.is_file():
        if target.name == "SKILL.md":
            return [target.parent]
        return []
    direct = target / "SKILL.md"
    if direct.is_file():
        return [target]
    out: list[Path] = []
    for entry in sorted(target.iterdir()):
        if not entry.is_dir() or entry.name.startswith("."):
            continue
        out.extend(_discover(entry))
    return out


def _validate_one(skill_dir: Path, extra_tiers: list[str]) -> Report:
    issues: list[Issue] = []
    skill_path = skill_dir / "SKILL.md"
    try:
        text = skill_path.read_text(encoding="utf-8")
    except OSError as e:
        issues.append(
            Issue("E100_SKILL_MD_MISSING", "error", "skill", f"SKILL.md not readable: {e}")
        )
        return _build(skill_path, issues)
    try:
        parsed = parse_frontmatter(text)
    except MissingFrontmatterError as e:
        issues.append(Issue("E101_FRONTMATTER_MISSING", "error", "frontmatter", str(e)))
        return _build(skill_path, issues)
    except MalformedFrontmatterError as e:
        issues.append(
            Issue("E102_FRONTMATTER_MALFORMED", "error", "frontmatter", str(e))
        )
        return _build(skill_path, issues)
    issues.extend(check_naming(parsed, skill_dir.name, {"extra_tiers": extra_tiers}))
    issues.extend(check_body(parsed))
    issues.extend(check_references(parsed, str(skill_dir)))
    issues.extend(check_optional_dirs(str(skill_dir)))
    return _build(skill_path, issues)


def _build(path: Path, issues: list[Issue]) -> Report:
    errors = sum(1 for i in issues if i.severity == "error")
    warnings = sum(1 for i in issues if i.severity == "warn")
    status = "FAIL" if errors > 0 else ("WARN" if warnings > 0 else "PASS")
    return Report(
        path=str(path),
        status=status,
        issues=issues,
        summary={"errors": errors, "warnings": warnings},
    )


def validate(args) -> tuple[int, str]:
    target = Path(args.path).resolve()
    extra = [t.strip() for t in (args.extra_tiers or "").split(",") if t.strip()]
    skills = _discover(target)
    if not skills:
        return 1, f"no SKILL.md found under: {args.path}\n"
    reports = [_validate_one(s, extra) for s in skills]
    total_errors = sum(r.summary["errors"] for r in reports)
    total_warnings = sum(r.summary["warnings"] for r in reports)
    if total_errors > 0:
        exit_code = 1
    elif args.strict and total_warnings > 0:
        exit_code = 2
    else:
        exit_code = 0
    if args.format == "json":
        if len(reports) == 1:
            out = format_json(reports[0])
        else:
            top = {
                "status": (
                    "FAIL" if total_errors > 0
                    else ("WARN" if total_warnings > 0 else "PASS")
                ),
                "reports": [r.to_dict() for r in reports],
                "summary": {"errors": total_errors, "warnings": total_warnings},
            }
            out = format_json(top)
    else:
        out = "".join(format_human(r, color=not args.no_color) for r in reports)
    return exit_code, out
