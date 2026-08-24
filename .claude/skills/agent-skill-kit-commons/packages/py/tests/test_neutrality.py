from types import SimpleNamespace

from skills_ref.lint.neutrality import check_vendor_neutrality


def _mk(raw_frontmatter):
    return SimpleNamespace(raw_frontmatter=raw_frontmatter)


def test_flags_claude_prefix():
    parsed = _mk({"name": "x", "description": "y", "tier": "org", "claude-priority": "high"})
    issues = check_vendor_neutrality(parsed)
    assert len(issues) == 1
    assert issues[0]["code"] == "L001_VENDOR_SPECIFIC_FIELD"
    assert issues[0]["severity"] == "warn"
    assert issues[0]["field"] == "claude-priority"
    assert "metadata" in issues[0]["message"]


def test_flags_cursor_and_devin():
    parsed = _mk({"cursor-mode": "fast", "devin-rate": 1})
    issues = check_vendor_neutrality(parsed)
    assert len(issues) == 2
    assert all(i["code"] == "L001_VENDOR_SPECIFIC_FIELD" for i in issues)


def test_ignores_allowed_top_level():
    parsed = _mk({
        "name": "x",
        "description": "y",
        "tier": "org",
        "license": "Apache-2.0",
        "compatibility": "anything",
        "metadata": {"foo": 1},
        "allowed-tools": ["Read"],
        "dependencies": [],
    })
    assert check_vendor_neutrality(parsed) == []


def test_non_vendor_unauthorized_passes():
    parsed = _mk({"myproject-internal": "foo"})
    assert check_vendor_neutrality(parsed) == []


def test_nested_under_metadata_no_flag():
    parsed = _mk({"metadata": {"claude-priority": "high"}})
    assert check_vendor_neutrality(parsed) == []


def test_missing_raw_frontmatter():
    assert check_vendor_neutrality(SimpleNamespace()) == []
    assert check_vendor_neutrality(SimpleNamespace(raw_frontmatter=None)) == []
