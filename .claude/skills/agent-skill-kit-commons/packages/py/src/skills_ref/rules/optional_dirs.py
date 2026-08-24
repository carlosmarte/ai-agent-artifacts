from __future__ import annotations

from pathlib import Path

from ..types import Issue

_OPTIONAL_DIRS = ["scripts", "references", "assets"]


def check_optional_dirs(skill_dir: str) -> list[Issue]:
    issues: list[Issue] = []
    base = Path(skill_dir)
    for d in _OPTIONAL_DIRS:
        p = base / d
        if not p.is_dir():
            continue
        entries = [e for e in p.iterdir() if not e.name.startswith(".")]
        if not entries:
            issues.append(
                Issue(
                    "W003_EMPTY_OPTIONAL_DIR",
                    "warn",
                    d,
                    f"optional directory '{d}/' exists but is empty",
                )
            )
    return issues
