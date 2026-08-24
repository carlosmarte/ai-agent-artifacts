from __future__ import annotations

import io
import re
from typing import Optional

from ruamel.yaml import YAML
from ruamel.yaml.error import YAMLError

from .types import DepRef, Parsed


class MissingFrontmatterError(Exception):
    pass


class MalformedFrontmatterError(Exception):
    pass


_DEP_RE = re.compile(
    r"^(?:(?P<owner>[A-Za-z0-9_.-]+)/(?P<repo>[A-Za-z0-9_.-]+)\#)?"
    r"(?P<name>[a-z0-9-]+)(?:@(?P<range>.+))?$"
)


def _normalize_dep(entry) -> Optional[DepRef]:
    if entry is None:
        return None
    if isinstance(entry, str):
        m = _DEP_RE.match(entry.strip())
        if not m:
            return DepRef(
                name=entry.strip(),
                version_range=None,
                origin="in_repo",
                owner=None,
                repo=None,
            )
        owner = m.group("owner")
        return DepRef(
            name=m.group("name"),
            version_range=m.group("range"),
            origin="cross_repo" if owner else "in_repo",
            owner=owner,
            repo=m.group("repo"),
        )
    if isinstance(entry, dict) and entry.get("name"):
        ref = entry.get("ref")
        if not ref:
            if entry.get("owner") and entry.get("repo"):
                ref = f"{entry['owner']}/{entry['repo']}#{entry['name']}"
            else:
                ref = entry["name"]
        if entry.get("version_range"):
            ref = f"{ref}@{entry['version_range']}"
        return _normalize_dep(ref)
    return None


def _normalize_allowed_tools(v) -> list:
    if v is None:
        return []
    if isinstance(v, list):
        return [str(x) for x in v]
    if isinstance(v, str):
        return [s.strip() for s in v.split(",") if s.strip()]
    return []


def _normalize_metadata(v) -> dict:
    if not isinstance(v, dict):
        return {}
    return {str(k): "" if val is None else str(val) for k, val in v.items()}


def parse_frontmatter(text: str) -> Parsed:
    if not isinstance(text, str):
        raise MissingFrontmatterError("input is not a string")
    stripped = text.lstrip("﻿")
    lines = stripped.split("\n")
    if not lines or lines[0].strip() != "---":
        raise MissingFrontmatterError(
            "frontmatter must begin with '---' on the first line"
        )
    close_idx = -1
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            close_idx = i
            break
    if close_idx == -1:
        raise MissingFrontmatterError(
            "frontmatter has no closing '---' delimiter"
        )
    yaml_block = "\n".join(lines[1:close_idx])
    yaml_loader = YAML(typ="safe")
    try:
        data = yaml_loader.load(io.StringIO(yaml_block))
    except YAMLError as e:
        raise MalformedFrontmatterError(
            f"frontmatter YAML is malformed: {e}"
        ) from e
    if data is None:
        data = {}
    if not isinstance(data, dict):
        raise MalformedFrontmatterError("frontmatter YAML must be a mapping")
    body = "\n".join(lines[close_idx + 1 :])
    source_offset = len("\n".join(lines[: close_idx + 1])) + 1
    raw_deps = data.get("dependencies") or []
    deps: list = []
    if isinstance(raw_deps, list):
        for e in raw_deps:
            d = _normalize_dep(e)
            if d is not None:
                deps.append(d)
    return Parsed(
        name=str(data["name"]) if data.get("name") is not None else None,
        description=str(data["description"])
        if data.get("description") is not None
        else None,
        tier=str(data["tier"]) if data.get("tier") is not None else None,
        license=str(data["license"]) if data.get("license") is not None else None,
        compatibility=str(data["compatibility"])
        if data.get("compatibility") is not None
        else None,
        metadata=_normalize_metadata(data.get("metadata")),
        allowed_tools=_normalize_allowed_tools(
            data.get("allowed-tools") if "allowed-tools" in data else data.get("allowed_tools")
        ),
        dependencies=deps,
        body=body,
        source_offset=source_offset,
        raw_frontmatter=dict(data),
    )


def to_canonical_json(obj) -> str:
    import json

    def to_plain(v):
        if hasattr(v, "to_dict"):
            return to_plain(v.to_dict())
        if isinstance(v, list):
            return [to_plain(x) for x in v]
        if isinstance(v, dict):
            return {str(k): to_plain(val) for k, val in v.items()}
        return v

    return json.dumps(to_plain(obj), sort_keys=True, separators=(",", ":"))
