from __future__ import annotations

from pathlib import Path

from skills_ref.prompt.read_properties import (
    PROPERTY_FIELDS,
    read_properties,
    read_properties_root,
)

REGISTRY = Path(__file__).resolve().parents[3] / "fixtures" / "prompt" / "registry"


def test_read_properties_single():
    out = read_properties(str(REGISTRY / "prompt-fix-a"))
    assert out["_path"].endswith("prompt-fix-a/SKILL.md")
    for f in PROPERTY_FIELDS:
        assert f in out
    assert out["name"] == "prompt-fix-a"
    assert out["tier"] == "org"
    assert out["license"] is None
    assert out["compatibility"] is None


def test_read_properties_dependencies_plain():
    out = read_properties(str(REGISTRY / "prompt-fix-b"))
    assert isinstance(out["dependencies"], list)
    assert out["dependencies"][0] == {
        "name": "prompt-fix-a",
        "origin": "in_repo",
        "owner": None,
        "repo": None,
        "version_range": None,
    }


def test_read_properties_path_is_absolute():
    out = read_properties(str(REGISTRY / "prompt-fix-a"))
    assert out["_path"].startswith("/")


def test_read_properties_root_sorted_by_name():
    arr = read_properties_root(str(REGISTRY))
    assert len(arr) == 5
    assert [o["name"] for o in arr] == [
        "prompt-fix-a",
        "prompt-fix-b",
        "prompt-fix-c",
        "prompt-fix-d",
        "prompt-fix-e",
    ]


def test_read_properties_root_shape():
    arr = read_properties_root(str(REGISTRY))
    for o in arr:
        assert "_path" in o
        for f in PROPERTY_FIELDS:
            assert f in o
