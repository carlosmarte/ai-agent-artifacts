from __future__ import annotations

import re
from pathlib import Path

_HOST_PATH_RE = re.compile(r"(/Users/|/home/|/tmp/)")
_TEXT_EXT = frozenset(
    {".sh", ".bash", ".py", ".mjs", ".js", ".ts", ".md", ".yaml", ".yml", ".json", ".toml", ".txt", ""}
)


def _walk_all(d: Path) -> list:
    out = []
    try:
        entries = sorted(d.iterdir(), key=lambda p: p.name)
    except OSError:
        return out
    for entry in entries:
        if entry.is_dir():
            out.extend(_walk_all(entry))
        elif entry.is_file():
            out.append(entry)
    return out


_INLINE_BACKTICK_RE = re.compile(r"`[^`]*`")


def _body_scan_lines(body: str):
    lines = body.split("\n")
    in_fence = False
    skip_fence = False
    out = []
    for i, line in enumerate(lines):
        m = re.match(r"^```(\S*)", line)
        if m:
            if not in_fence:
                in_fence = True
                lang = (m.group(1) or "").lower()
                skip_fence = lang in ("text", "console", "bash")
            else:
                in_fence = False
                skip_fence = False
            continue
        if in_fence and skip_fence:
            continue
        if line.lstrip().startswith(">"):
            continue
        scrubbed = _INLINE_BACKTICK_RE.sub("", line)
        out.append((scrubbed, i, line))
    return out


def audit_path_leak(registry) -> list:
    findings = []
    for name, node in registry.nodes.items():
        d = node.get("dir")
        if not d:
            continue
        body = node.get("body") or ""
        if body:
            for scrubbed, i, raw in _body_scan_lines(body):
                if _HOST_PATH_RE.search(scrubbed):
                    findings.append(
                        {
                            "severity": "MEDIUM",
                            "code": "A030_HOST_PATH_LEAK",
                            "where": f"{d}/SKILL.md:body+{i + 1}",
                            "message": f"host-path literal in body: {raw.strip()}",
                        }
                    )
        scripts_dir = Path(d) / "scripts"
        if not scripts_dir.is_dir():
            continue
        for file in _walk_all(scripts_dir):
            if file.suffix not in _TEXT_EXT:
                continue
            try:
                text = file.read_text(encoding="utf-8")
            except OSError:
                continue
            for i, line in enumerate(text.split("\n")):
                if _HOST_PATH_RE.search(line):
                    findings.append(
                        {
                            "severity": "MEDIUM",
                            "code": "A030_HOST_PATH_LEAK",
                            "where": f"{file}:{i + 1}",
                            "message": f"host-path literal: {line.strip()}",
                        }
                    )
    return findings
