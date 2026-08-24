from __future__ import annotations

from skills_ref.optimize.score import hit_rate

queries = {
    "positive": [
        "validate the frontmatter",
        "scaffold the skill",
        "audit the dependencies",
    ],
    "negative": [
        "format this csv file",
        "deploy to staging",
        "rotate the api keys",
    ],
}


def test_full_positive_overlap():
    r = hit_rate(
        "Validate the frontmatter, scaffold the skill, audit the dependencies.",
        queries,
    )
    assert r["positive_hits"] == 3
    assert r["false_positives"] == 0
    assert r["score"] == 100


def test_no_false_positives():
    r = hit_rate("Score the description.", queries)
    assert r["false_positives"] == 0


def test_penalize_negative_overlap():
    r = hit_rate("Format this csv and deploy to staging.", queries)
    assert r["false_positives"] > 0
    assert r["score"] <= 0


def test_score_clamped():
    r = hit_rate("", queries)
    assert r["score"] == 0
