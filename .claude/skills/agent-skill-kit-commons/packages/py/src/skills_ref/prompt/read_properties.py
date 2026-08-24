from __future__ import annotations

from pathlib import Path

from ..parser import parse_frontmatter
from ..registry import build_registry

PROPERTY_FIELDS = (
    "name",
    "description",
    "tier",
    "license",
    "compatibility",
    "metadata",
    "allowed_tools",
    "dependencies",
)


def _dep_to_plain(d) -> dict:
    return {
        "name": getattr(d, "name", None),
        "origin": getattr(d, "origin", None),
        "owner": getattr(d, "owner", None),
        "repo": getattr(d, "repo", None),
        "version_range": getattr(d, "version_range", None),
    }


def _plainize(field: str, value):
    if field == "dependencies" and isinstance(value, list):
        return [_dep_to_plain(d) for d in value]
    return value


def read_properties(skill_dir) -> dict:
    abs_dir = Path(skill_dir).resolve()
    skill_path = abs_dir / "SKILL.md"
    text = skill_path.read_text(encoding="utf-8")
    parsed = parse_frontmatter(text)
    out = {"_path": str(skill_path)}
    for f in PROPERTY_FIELDS:
        v = getattr(parsed, f, None)
        if v is None:
            out[f] = None
        else:
            out[f] = _plainize(f, v)
    return out


def read_properties_root(root_dir) -> list:
    root = Path(root_dir).resolve()
    if not root.is_dir():
        raise NotADirectoryError(f"not a directory: {root_dir}")
    reg = build_registry(str(root))
    out: list = []
    for _, node in reg.nodes.items():
        if node.get("parse_error"):
            continue
        out.append(read_properties(node["dir"]))
    out.sort(key=lambda o: o.get("name") or "")
    return out
