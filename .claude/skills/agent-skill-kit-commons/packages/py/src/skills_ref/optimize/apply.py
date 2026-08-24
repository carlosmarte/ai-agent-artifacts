from __future__ import annotations

import re
import shutil
from pathlib import Path


def find_description_line(lines: list[str]) -> int:
    seen_open = False
    for i, line in enumerate(lines):
        if line.strip() == "---":
            if not seen_open:
                seen_open = True
                continue
            return -1
        if seen_open and re.match(r"^description:\s", line):
            return i
    return -1


def apply_variant(skill_dir: str, variant: dict) -> dict:
    path = Path(skill_dir) / "SKILL.md"
    original = path.read_text(encoding="utf-8")
    lines = original.split("\n")
    idx = find_description_line(lines)
    if idx == -1:
        raise ValueError("description: line not found in frontmatter")
    lines[idx] = f"description: {variant['text']}"
    rewritten = "\n".join(lines)
    bak = path.with_suffix(path.suffix + ".bak")
    shutil.copyfile(path, bak)
    path.write_text(rewritten, encoding="utf-8")
    return {"applied": True, "backup": str(bak), "original_line": original.split("\n")[idx]}


def commit(backup: str) -> None:
    if backup:
        p = Path(backup)
        if p.exists():
            p.unlink()


def rollback(skill_dir: str, backup: str) -> bool:
    path = Path(skill_dir) / "SKILL.md"
    bak = Path(backup) if backup else None
    if bak and bak.exists():
        shutil.copyfile(bak, path)
        bak.unlink()
        return True
    return False
