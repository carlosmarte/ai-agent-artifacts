from __future__ import annotations

import json
import re
from pathlib import Path

_PATTERNS_PATH = Path(__file__).resolve().parent.parent / "assets" / "injection_patterns.json"

_PATTERNS = None


def _patterns():
    global _PATTERNS
    if _PATTERNS is None:
        raw = json.loads(_PATTERNS_PATH.read_text(encoding="utf-8"))
        _PATTERNS = [
            {
                "id": p["id"],
                "re": re.compile(p["pattern"]),
                "languages": set(p["languages"]),
            }
            for p in raw
        ]
    return _PATTERNS


def _walk_scripts(scripts_dir: Path) -> list:
    out = []
    try:
        entries = sorted(scripts_dir.iterdir(), key=lambda p: p.name)
    except OSError:
        return out
    for entry in entries:
        if entry.is_dir():
            out.extend(_walk_scripts(entry))
        elif entry.is_file():
            out.append(entry)
    return out


def audit_scripts(registry) -> list:
    pats = _patterns()
    findings = []
    for name, node in registry.nodes.items():
        d = node.get("dir")
        if not d:
            continue
        scripts_dir = Path(d) / "scripts"
        if not scripts_dir.is_dir():
            continue
        for file in _walk_scripts(scripts_dir):
            ext = file.suffix
            applicable = [p for p in pats if ext in p["languages"]]
            if not applicable:
                continue
            try:
                text = file.read_text(encoding="utf-8")
            except OSError:
                continue
            lines = text.split("\n")
            for i, line in enumerate(lines):
                for p in applicable:
                    if p["re"].search(line):
                        findings.append(
                            {
                                "severity": "HIGH",
                                "code": "A010_COMMAND_INJECTION_PATTERN",
                                "where": f"{file}:{i + 1}",
                                "message": (
                                    f"command-injection pattern '{p['id']}' matched: "
                                    f"{line.strip()}"
                                ),
                            }
                        )
    return findings
