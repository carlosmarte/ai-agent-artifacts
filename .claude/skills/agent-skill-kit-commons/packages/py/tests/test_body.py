from skills_ref.rules.body import check_body
from skills_ref.types import Parsed


def p(body):
    return Parsed(
        name="org-x",
        description="x",
        tier="org",
        license=None,
        compatibility=None,
        metadata={},
        allowed_tools=[],
        dependencies=[],
        body=body,
        source_offset=0,
    )


def test_clean_short_body():
    assert check_body(p("hello world\nstill hello")) == []


def test_empty_body():
    issues = check_body(p(""))
    assert any(i.code == "E011_BODY_MISSING" for i in issues)


def test_600_line_body():
    body = "line\n" * 600
    issues = check_body(p(body))
    assert sum(1 for i in issues if i.code == "W001_BODY_TOO_LONG") == 1


def test_absolute_path_in_body():
    issues = check_body(p("see /Users/foo/bar for the script"))
    assert any(i.code == "E010_ABSOLUTE_PATH_IN_BODY" for i in issues)


def test_absolute_path_in_code_block_ignored():
    issues = check_body(p("see code:\n```\n/Users/foo/bar\n```\n"))
    assert not any(i.code == "E010_ABSOLUTE_PATH_IN_BODY" for i in issues)
