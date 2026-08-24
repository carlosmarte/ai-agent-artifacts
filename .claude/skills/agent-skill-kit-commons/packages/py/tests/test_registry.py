from pathlib import Path


from skills_ref.registry import build_registry


def _write_skill(root: Path, name: str, frontmatter: dict, body: str = "body content") -> Path:
    d = root / name
    d.mkdir(parents=True, exist_ok=True)
    lines = ["---"]
    for k, v in frontmatter.items():
        if isinstance(v, list):
            lines.append(f"{k}:")
            for x in v:
                lines.append(f"  - {x}")
        else:
            lines.append(f"{k}: {v}")
    lines.append("---")
    lines.append(body)
    (d / "SKILL.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return d


def test_empty_root_returns_empty_registry(tmp_path: Path):
    reg = build_registry(str(tmp_path))
    assert list(reg.nodes.keys()) == []
    assert list(reg.edges.keys()) == []


def test_one_valid_skill(tmp_path: Path):
    _write_skill(
        tmp_path,
        "org-alpha",
        {"name": "org-alpha", "description": "alpha desc", "tier": "org"},
    )
    reg = build_registry(str(tmp_path))
    assert list(reg.nodes.keys()) == ["org-alpha"]
    assert reg.nodes["org-alpha"]["tier"] == "org"
    assert reg.edges["org-alpha"] == []


def test_invalid_skill_records_parse_error(tmp_path: Path):
    _write_skill(
        tmp_path,
        "org-good",
        {"name": "org-good", "description": "g", "tier": "org"},
    )
    bad = tmp_path / "org-bad"
    bad.mkdir()
    (bad / "SKILL.md").write_text("---\nname: : :\n---\nbody\n", encoding="utf-8")
    reg = build_registry(str(tmp_path))
    assert sorted(reg.nodes.keys()) == ["org-bad", "org-good"]
    assert reg.nodes["org-bad"].get("parse_error")
    assert "org-bad" not in reg.edges


def test_deeply_nested_skills_excluded(tmp_path: Path):
    deep = tmp_path / "a" / "b" / "c" / "d" / "deep-skill"
    deep.mkdir(parents=True)
    (deep / "SKILL.md").write_text(
        "---\nname: deep-skill\ndescription: d\ntier: org\n---\nbody\n",
        encoding="utf-8",
    )
    reg = build_registry(str(tmp_path), max_depth=3)
    assert list(reg.nodes.keys()) == []


def test_name_collision_last_wins_with_warning(tmp_path: Path):
    a = tmp_path / "wrap-a"
    b = tmp_path / "wrap-b"
    a.mkdir()
    b.mkdir()
    (a / "SKILL.md").write_text(
        "---\nname: same-name\ndescription: A\ntier: org\n---\nA\n",
        encoding="utf-8",
    )
    (b / "SKILL.md").write_text(
        "---\nname: same-name\ndescription: B\ntier: org\n---\nB\n",
        encoding="utf-8",
    )
    reg = build_registry(str(tmp_path))
    assert list(reg.nodes.keys()) == ["same-name"]
    assert reg.nodes["same-name"]["description"] == "B"
    assert any("same-name" in w for w in reg.warnings)


def test_does_not_recurse_into_skill_dir(tmp_path: Path):
    outer = tmp_path / "outer"
    outer.mkdir()
    (outer / "SKILL.md").write_text(
        "---\nname: outer\ndescription: d\ntier: org\n---\nbody\n",
        encoding="utf-8",
    )
    inner = outer / "inner-skill"
    inner.mkdir()
    (inner / "SKILL.md").write_text(
        "---\nname: inner\ndescription: d\ntier: org\n---\nbody\n",
        encoding="utf-8",
    )
    reg = build_registry(str(tmp_path))
    assert list(reg.nodes.keys()) == ["outer"]
