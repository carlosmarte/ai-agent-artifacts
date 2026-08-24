from __future__ import annotations

from skills_ref.prompt.xml import serialize_available_skills, xml_escape


def test_xml_escape_five_chars():
    assert (
        xml_escape("a & b < c > d \" e ' f")
        == "a &amp; b &lt; c &gt; d &quot; e &apos; f"
    )


def test_xml_escape_none():
    assert xml_escape(None) == ""


def test_xml_escape_plain():
    assert xml_escape("plain ascii 123") == "plain ascii 123"


def test_serialize_empty():
    assert serialize_available_skills([]) == "<available_skills>\n</available_skills>\n"


def test_serialize_one_entry_escapes_description():
    out = serialize_available_skills(
        [{"name": "x", "tier": "org", "description": "y < z"}]
    )
    assert (
        out
        == '<available_skills>\n  <skill name="x" tier="org">y &lt; z</skill>\n</available_skills>\n'
    )


def test_serialize_invalid_attribute():
    out = serialize_available_skills(
        [{"name": "x", "tier": "org", "description": "d", "invalid": True}]
    )
    assert '<skill name="x" tier="org" invalid="true">d</skill>' in out


def test_serialize_truncated_marker():
    out = serialize_available_skills(
        [{"name": "x", "tier": "org", "description": "d"}], truncated=3
    )
    assert '  <truncated count="3"/>\n' in out


def test_serialize_escapes_attributes():
    out = serialize_available_skills(
        [{"name": 'q"u', "tier": "o>r", "description": "d"}]
    )
    assert 'name="q&quot;u"' in out
    assert 'tier="o&gt;r"' in out
