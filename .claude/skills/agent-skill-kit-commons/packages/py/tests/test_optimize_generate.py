from __future__ import annotations

from dataclasses import dataclass

from skills_ref.optimize.generate import (
    extract_verbs_and_nouns,
    generate_deterministic,
)


@dataclass
class _Parsed:
    description: str
    body: str


parsed = _Parsed(
    description="Validate the frontmatter and audit the dependencies.",
    body="scaffold the skill, validate the registry, audit the graph, score the description.",
)


def test_extract_verbs_includes_body_and_description():
    verbs, _ = extract_verbs_and_nouns(parsed)
    assert "validate" in verbs
    assert "audit" in verbs
    assert "scaffold" in verbs


def test_extract_nouns_includes_both():
    _, nouns = extract_verbs_and_nouns(parsed)
    assert "frontmatter" in nouns
    assert "dependencies" in nouns
    assert "registry" in nouns


def test_generate_deterministic_n_pos_n_neg():
    out = generate_deterministic(parsed, 4)
    assert len(out["positive"]) == 4
    assert len(out["negative"]) == 4


def test_generate_deterministic_stable():
    a = generate_deterministic(parsed, 4)
    b = generate_deterministic(parsed, 4)
    assert a == b


def test_generate_positives_use_skill_vocab():
    out = generate_deterministic(parsed, 4)
    first = out["positive"][0]
    assert first.split(" ", 1)[0] in {"validate", "scaffold", "audit", "score"}
