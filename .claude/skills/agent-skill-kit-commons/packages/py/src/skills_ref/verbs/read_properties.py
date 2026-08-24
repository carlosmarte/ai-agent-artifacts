from __future__ import annotations

import json
from pathlib import Path

from ..parser import MalformedFrontmatterError, MissingFrontmatterError
from ..prompt.read_properties import read_properties, read_properties_root


def _sort(v):
    if isinstance(v, list):
        return [_sort(x) for x in v]
    if isinstance(v, dict):
        return {k: _sort(v[k]) for k in sorted(v.keys())}
    return v


def read_properties_verb(args) -> tuple[int, str]:
    path = Path(args.path)
    try:
        target = path.resolve(strict=True)
    except (OSError, FileNotFoundError):
        return 2, f"no SKILL.md found under: {args.path}\n"

    if getattr(args, "root_mode", False):
        try:
            arr = read_properties_root(str(target))
        except (MissingFrontmatterError, MalformedFrontmatterError) as e:
            return 1, f"read-properties: {e}\n"
        except Exception as e:
            return 1, f"read-properties: {e}\n"
        if not arr:
            return 2, f"no SKILL.md found under: {args.path}\n"
        return 0, json.dumps([_sort(x) for x in arr], indent=2, ensure_ascii=False) + "\n"

    if not target.is_dir():
        return 2, f"no SKILL.md found under: {args.path}\n"
    if not (target / "SKILL.md").is_file():
        return 2, f"no SKILL.md found under: {args.path}\n"
    try:
        obj = read_properties(str(target))
    except (MissingFrontmatterError, MalformedFrontmatterError) as e:
        return 1, f"read-properties: {e}\n"
    except Exception as e:
        return 1, f"read-properties: {e}\n"
    return 0, json.dumps(_sort(obj), indent=2, ensure_ascii=False) + "\n"
