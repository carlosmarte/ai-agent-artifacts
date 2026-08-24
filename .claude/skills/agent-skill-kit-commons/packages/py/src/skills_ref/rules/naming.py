from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Callable, Optional

from ..types import Issue, Parsed


@dataclass
class _Rule:
    code: str
    severity: str
    field: str
    message: str
    check: Callable


NAMING_RULES: list[_Rule] = [
    _Rule(
        "E000_NAME_MISSING",
        "error",
        "name",
        "name is required",
        lambda p, d, o: not p.name,
    ),
    _Rule(
        "E001_NAME_TOO_LONG",
        "error",
        "name",
        "name must be 1-64 chars",
        lambda p, d, o: bool(p.name) and len(p.name) > 64,
    ),
    _Rule(
        "E002_NAME_BAD_CHAR",
        "error",
        "name",
        "name must use only [a-z0-9-]",
        lambda p, d, o: bool(p.name) and not re.fullmatch(r"[a-z0-9-]+", p.name),
    ),
    _Rule(
        "E003_NAME_HYPHEN_EDGE",
        "error",
        "name",
        "name cannot start or end with '-'",
        lambda p, d, o: bool(p.name)
        and (p.name.startswith("-") or p.name.endswith("-")),
    ),
    _Rule(
        "E004_NAME_CONSECUTIVE_HYPHENS",
        "error",
        "name",
        "name cannot contain '--'",
        lambda p, d, o: bool(p.name) and "--" in p.name,
    ),
    _Rule(
        "E005_NAME_DIRECTORY_MISMATCH",
        "error",
        "name",
        "name must equal parent directory name",
        lambda p, d, o: bool(p.name) and bool(d) and p.name != d,
    ),
    _Rule(
        "E006_TIER_MISSING",
        "error",
        "tier",
        "tier is required",
        lambda p, d, o: not p.tier,
    ),
    _Rule(
        "E007_TIER_INVALID",
        "error",
        "tier",
        "tier must be one of org|team|app|project",
        lambda p, d, o: bool(p.tier) and p.tier not in o["allowed_tiers"],
    ),
    _Rule(
        "E008_DESCRIPTION_MISSING",
        "error",
        "description",
        "description is required",
        lambda p, d, o: not p.description,
    ),
    _Rule(
        "E012_DESCRIPTION_TOO_LONG",
        "error",
        "description",
        "description must be 1-1024 chars",
        lambda p, d, o: bool(p.description) and len(p.description) > 1024,
    ),
    _Rule(
        "E009_DESCRIPTION_TOO_SHORT",
        "warn",
        "description",
        "description < 60 chars; may not trigger reliably",
        lambda p, d, o: bool(p.description) and len(p.description) < 60,
    ),
]

_DEFAULT_TIERS = ["org", "team", "app", "project"]


def check_naming(
    parsed: Parsed,
    directory: Optional[str],
    opts: Optional[dict] = None,
) -> list[Issue]:
    opts = opts or {}
    extra = opts.get("extra_tiers", [])
    allowed = opts.get("allowed_tiers") or _DEFAULT_TIERS + list(extra)
    merged = {"allowed_tiers": allowed}
    issues: list[Issue] = []
    for r in NAMING_RULES:
        if r.check(parsed, directory, merged):
            issues.append(Issue(r.code, r.severity, r.field, r.message))
    return issues
