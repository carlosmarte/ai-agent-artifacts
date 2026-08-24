from __future__ import annotations

import re
from pathlib import Path

from ..types import Issue, Parsed

_LINK_RE = re.compile(r"\[[^\]]*\]\(([^)#?]+)(?:[?#][^)]*)?\)")
_URL_RE = re.compile(r"^(https?:|mailto:|tel:|ftp:|#)")


def check_references(parsed: Parsed, skill_dir: str) -> list[Issue]:
    issues: list[Issue] = []
    body = parsed.body or ""
    base = Path(skill_dir)
    for m in _LINK_RE.finditer(body):
        target = m.group(1).strip()
        if not target:
            continue
        if _URL_RE.match(target):
            continue
        if target.startswith("/"):
            continue
        full = (base / target).resolve()
        if not full.exists():
            issues.append(
                Issue(
                    "W002_BROKEN_REFERENCE",
                    "warn",
                    "body",
                    f"broken reference: {target}",
                )
            )
    return issues
