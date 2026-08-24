from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from .parser import (
    MalformedFrontmatterError,
    MissingFrontmatterError,
    parse_frontmatter,
)


@dataclass
class Registry:
    nodes: dict
    edges: dict
    warnings: list = field(default_factory=list)


def build_registry(root_dir: str, max_depth: int = 3) -> Registry:
    nodes: dict = {}
    edges: dict = {}
    warnings: list = []
    _walk(Path(root_dir), 0, max_depth, nodes, edges, warnings)
    return Registry(
        nodes=dict(sorted(nodes.items())),
        edges=dict(sorted(edges.items())),
        warnings=warnings,
    )


def _walk(
    d: Path,
    depth: int,
    max_depth: int,
    nodes: dict,
    edges: dict,
    warnings: list,
) -> None:
    if depth > max_depth or not d.is_dir():
        return
    children = sorted(d.iterdir(), key=lambda p: p.name)
    for child in children:
        if not child.is_dir() or child.name.startswith("."):
            continue
        skill_file = child / "SKILL.md"
        if skill_file.is_file():
            try:
                parsed = parse_frontmatter(skill_file.read_text(encoding="utf-8"))
            except (MissingFrontmatterError, MalformedFrontmatterError) as err:
                key = child.name
                if key in nodes:
                    warnings.append(f"name collision on '{key}'; last entry wins")
                nodes[key] = {
                    "name": key,
                    "dir": str(child),
                    "parse_error": str(err),
                }
                continue  # do not recurse into a skill dir
            key = parsed.name or child.name
            if key in nodes:
                warnings.append(f"name collision on '{key}'; last entry wins")
            node = {
                "name": parsed.name,
                "description": parsed.description,
                "tier": parsed.tier,
                "license": parsed.license,
                "compatibility": parsed.compatibility,
                "metadata": parsed.metadata,
                "allowed_tools": parsed.allowed_tools,
                "dependencies": parsed.dependencies,
                "body": parsed.body,
                "source_offset": parsed.source_offset,
                "raw_frontmatter": parsed.raw_frontmatter,
                "dir": str(child),
            }
            nodes[key] = node
            edges[key] = parsed.dependencies
            continue
        _walk(child, depth + 1, max_depth, nodes, edges, warnings)
