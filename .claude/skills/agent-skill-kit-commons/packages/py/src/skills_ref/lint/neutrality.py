from __future__ import annotations

from pathlib import Path

_PREFIXES_PATH = (
    Path(__file__).resolve().parent.parent / "assets" / "vendor_prefixes.txt"
)

_PREFIXES: list[str] | None = None


def _load_prefixes() -> list[str]:
    global _PREFIXES
    if _PREFIXES is None:
        _PREFIXES = [
            s.strip()
            for s in _PREFIXES_PATH.read_text(encoding="utf-8").split("\n")
            if s.strip()
        ]
    return _PREFIXES


_ALLOWED_TOP_LEVEL = {
    "name",
    "description",
    "tier",
    "license",
    "compatibility",
    "metadata",
    "allowed-tools",
    "dependencies",
}


def check_vendor_neutrality(parsed) -> list[dict]:
    issues: list[dict] = []
    prefixes = _load_prefixes()
    raw = getattr(parsed, "raw_frontmatter", None) or {}
    for key in raw.keys():
        if key in _ALLOWED_TOP_LEVEL:
            continue
        if any(key.startswith(p) for p in prefixes):
            issues.append(
                {
                    "code": "L001_VENDOR_SPECIFIC_FIELD",
                    "severity": "warn",
                    "field": key,
                    "message": (
                        f"'{key}' is vendor-specific; move under 'metadata' "
                        "to preserve portability across agents"
                    ),
                }
            )
    return issues
