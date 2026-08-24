import pytest

from skills_ref.parser import (
    MalformedFrontmatterError,
    MissingFrontmatterError,
    parse_frontmatter,
)


def test_happy_path():
    out = parse_frontmatter("---\nname: org-x\ndescription: y\ntier: org\n---\nbody")
    assert out.name == "org-x"
    assert out.description == "y"
    assert out.tier == "org"
    assert out.body == "body"
    assert out.dependencies == []


def test_missing_opening():
    with pytest.raises(MissingFrontmatterError):
        parse_frontmatter("hello world\n")


def test_missing_closing():
    with pytest.raises(MissingFrontmatterError):
        parse_frontmatter("---\nname: x\nno-closer")


def test_malformed_yaml():
    with pytest.raises(MalformedFrontmatterError):
        parse_frontmatter("---\nname: : :\n---\nbody")


def test_dep_pinned_in_repo():
    out = parse_frontmatter(
        "---\nname: org-a\ndescription: d\ntier: org\n"
        "dependencies:\n  - agent-creation@^1.0.0\n---\n"
    )
    assert len(out.dependencies) == 1
    d = out.dependencies[0]
    assert d.name == "agent-creation"
    assert d.version_range == "^1.0.0"
    assert d.origin == "in_repo"


def test_dep_cross_repo():
    out = parse_frontmatter(
        "---\nname: org-a\ndescription: d\ntier: org\n"
        "dependencies:\n  - acme/governance#security-baseline@~2.1\n---\n"
    )
    d = out.dependencies[0]
    assert d.name == "security-baseline"
    assert d.version_range == "~2.1"
    assert d.origin == "cross_repo"
    assert d.owner == "acme"
    assert d.repo == "governance"


def test_empty_body():
    out = parse_frontmatter("---\nname: org-a\ndescription: d\ntier: org\n---\n")
    assert out.body.strip() == ""
