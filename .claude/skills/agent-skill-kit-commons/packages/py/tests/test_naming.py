from skills_ref.rules.naming import NAMING_RULES, check_naming
from skills_ref.types import Parsed


def p(**over) -> Parsed:
    base = dict(
        name="org-clean",
        description=(
            "A long enough description (well over the 60-char floor) "
            "to keep description-too-short warn from firing."
        ),
        tier="org",
        license=None,
        compatibility=None,
        metadata={},
        allowed_tools=[],
        dependencies=[],
        body="hello",
        source_offset=0,
    )
    base.update(over)
    return Parsed(**base)


def test_baseline_clean():
    assert check_naming(p(), "org-clean") == []


def test_too_long():
    name = "org-" + "a" * 80
    issues = check_naming(p(name=name), name)
    assert any(i.code == "E001_NAME_TOO_LONG" for i in issues)


def test_bad_char():
    issues = check_naming(p(name="org-Bad"), "org-Bad")
    assert any(i.code == "E002_NAME_BAD_CHAR" for i in issues)


def test_hyphen_edge():
    issues = check_naming(p(name="-org-x"), "-org-x")
    assert any(i.code == "E003_NAME_HYPHEN_EDGE" for i in issues)


def test_consecutive_hyphens():
    issues = check_naming(p(name="org--x"), "org--x")
    assert any(i.code == "E004_NAME_CONSECUTIVE_HYPHENS" for i in issues)


def test_dir_mismatch():
    issues = check_naming(p(), "different-dir")
    assert any(i.code == "E005_NAME_DIRECTORY_MISMATCH" for i in issues)


def test_tier_missing():
    issues = check_naming(p(tier=None), "org-clean")
    assert any(i.code == "E006_TIER_MISSING" for i in issues)


def test_tier_invalid():
    issues = check_naming(p(tier="wildcat"), "org-clean")
    assert any(i.code == "E007_TIER_INVALID" for i in issues)


def test_extra_tiers_allowed():
    issues = check_naming(
        p(tier="company"), "org-clean", {"extra_tiers": ["company"]}
    )
    assert not any(i.code == "E007_TIER_INVALID" for i in issues)


def test_description_too_long():
    issues = check_naming(p(description="a" * 1100), "org-clean")
    assert any(i.code == "E012_DESCRIPTION_TOO_LONG" for i in issues)


def test_description_too_short():
    issues = check_naming(p(description="short"), "org-clean")
    w = next((i for i in issues if i.code == "E009_DESCRIPTION_TOO_SHORT"), None)
    assert w is not None and w.severity == "warn"


def test_rules_table_exported():
    assert len(NAMING_RULES) >= 11


def test_rule_code_prefixes_are_unique():
    prefixes = [r.code.split("_", 1)[0] for r in NAMING_RULES]
    assert len(set(prefixes)) == len(prefixes)
