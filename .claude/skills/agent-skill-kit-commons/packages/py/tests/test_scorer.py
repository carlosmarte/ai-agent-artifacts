from skills_ref.lint.scorer import load_assets, score_description


def test_load_assets_minimum_counts():
    a = load_assets()
    assert len(a["vague"]) >= 30
    assert len(a["verbs"]) >= 50
    assert len(a["stop"]) >= 100


def test_load_assets_memoized():
    a = load_assets()
    b = load_assets()
    assert a is b


def test_low_quality_vague_below_30():
    r = score_description("A useful tool that helps with stuff.", "")
    assert r["score"] < 30


def test_high_quality_scores_well():
    r = score_description(
        "Validate a SKILL.md frontmatter against the agentskills.io spec. Use when the user asks to lint, check, or validate a skill before committing.",
        "Validate SKILL.md frontmatter against the agentskills.io spec. Lint a skill before committing.",
    )
    assert r["score"] >= 60


def test_documented_shape():
    r = score_description("hello", "world")
    assert "score" in r
    assert "keywordDensity" in r["breakdown"]
    assert "actionVerbs" in r["breakdown"]
    assert "triggerPhrases" in r["breakdown"]
    assert "specificity" in r["breakdown"]
    assert "length" in r["breakdown"]
    assert isinstance(r["warnings"], list)


def test_first_token_verb_20():
    r = score_description("validate a thing", "")
    assert r["breakdown"]["actionVerbs"] == 20


def test_any_position_verb_8():
    r = score_description("the team will validate this thing", "")
    assert r["breakdown"]["actionVerbs"] == 8


def test_no_verb_0_and_warns():
    r = score_description("the thing exists here", "")
    assert r["breakdown"]["actionVerbs"] == 0
    assert any("does not lead with an action verb" in w for w in r["warnings"])


def test_trigger_use_when_20():
    r = score_description("Do a thing. Use when X happens.", "")
    assert r["breakdown"]["triggerPhrases"] == 20


def test_trigger_when_space_20():
    r = score_description("Do a thing when something happens", "")
    assert r["breakdown"]["triggerPhrases"] == 20


def test_no_trigger_0_and_warns():
    r = score_description("Do a thing.", "")
    assert r["breakdown"]["triggerPhrases"] == 0
    assert any("lacks a trigger phrase" in w for w in r["warnings"])


def test_vague_helps_with_penalty():
    r = score_description("A skill that helps with things", "")
    assert r["breakdown"]["specificity"] == 15
    assert any("vague phrases" in w for w in r["warnings"])


def test_vague_multi_stack():
    r = score_description(
        "Helps with stuff and assists with general purpose tasks",
        "",
    )
    assert r["breakdown"]["specificity"] <= 5


def test_length_below_sweet_spot():
    r = score_description("a" * 30, "")
    assert r["breakdown"]["length"] == 8


def test_length_above_sweet_spot():
    r = score_description("a" * 400, "")
    assert r["breakdown"]["length"] == 13


def test_length_in_sweet_spot():
    r = score_description("a" * 150, "")
    assert r["breakdown"]["length"] == 15


def test_keyword_density_full_overlap():
    r = score_description(
        "validate skill frontmatter",
        "validate skill frontmatter against spec",
    )
    assert r["breakdown"]["keywordDensity"] == 25


def test_keyword_density_zero():
    r = score_description("validate skill", "completely unrelated text")
    assert r["breakdown"]["keywordDensity"] == 0


def test_score_clamped_to_100():
    r = score_description(
        "Validate a SKILL.md frontmatter against the agentskills.io spec. Use when the user asks to lint, check, or validate a skill before committing.",
        "validate skill frontmatter agentskills spec lint check before committing user asks",
    )
    assert r["score"] <= 100
