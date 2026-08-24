from __future__ import annotations

import re

from ..types import Issue, Parsed

_ABS_PATH_RE = re.compile(r"(^|\s)(/[A-Za-z][^\s)`'\"]*)", re.MULTILINE)
_FENCED_RE = re.compile(r"```[\s\S]*?```")
_INLINE_CODE_RE = re.compile(r"`[^`\n]*`")


def check_body(parsed: Parsed) -> list[Issue]:
    issues: list[Issue] = []
    body = parsed.body or ""
    if not body.strip():
        issues.append(Issue("E011_BODY_MISSING", "error", "body", "body must not be empty"))
    lines = len(body.split("\n"))
    if lines > 500:
        issues.append(
            Issue(
                "W001_BODY_TOO_LONG",
                "warn",
                "body",
                f"body has {lines} lines (recommend <= 500)",
            )
        )
    scrub = _INLINE_CODE_RE.sub("", _FENCED_RE.sub("", body))
    for m in _ABS_PATH_RE.finditer(scrub):
        issues.append(
            Issue(
                "E010_ABSOLUTE_PATH_IN_BODY",
                "error",
                "body",
                f"absolute path in body: {m.group(2)}",
                m.start(2),
            )
        )
    return issues
