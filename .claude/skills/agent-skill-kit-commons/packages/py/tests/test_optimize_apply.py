from __future__ import annotations

from pathlib import Path

import pytest

from skills_ref.optimize.apply import (
    apply_variant,
    commit,
    find_description_line,
    rollback,
)


ORIGINAL = "\n".join(
    [
        "---",
        "name: tmp-skill",
        "description: original description that is somewhat long and likely to trigger naming rule pass.",
        "tier: org",
        "---",
        "",
        "# tmp-skill",
        "",
        "Body content.",
        "",
    ]
)


@pytest.fixture
def tmp_skill(tmp_path: Path):
    p = tmp_path / "SKILL.md"
    p.write_text(ORIGINAL, encoding="utf-8")
    return tmp_path


def test_find_description_line():
    lines = ORIGINAL.split("\n")
    assert find_description_line(lines) == 2


def test_find_description_line_none():
    assert find_description_line(["", "no frontmatter"]) == -1


def test_apply_replaces_only_description(tmp_skill: Path):
    res = apply_variant(str(tmp_skill), {"text": "new description here"})
    post = (tmp_skill / "SKILL.md").read_text(encoding="utf-8").split("\n")
    pre = ORIGINAL.split("\n")
    assert post[2] == "description: new description here"
    for i, line in enumerate(pre):
        if i == 2:
            continue
        assert post[i] == line
    assert Path(res["backup"]).exists()


def test_commit_removes_backup(tmp_skill: Path):
    res = apply_variant(str(tmp_skill), {"text": "new description here"})
    commit(res["backup"])
    assert not Path(res["backup"]).exists()


def test_rollback_restores(tmp_skill: Path):
    res = apply_variant(str(tmp_skill), {"text": "ought to be reverted"})
    restored = rollback(str(tmp_skill), res["backup"])
    assert restored
    assert (tmp_skill / "SKILL.md").read_text(encoding="utf-8") == ORIGINAL
    assert not Path(res["backup"]).exists()
