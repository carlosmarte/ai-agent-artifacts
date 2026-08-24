from __future__ import annotations

from pathlib import Path

from ..lint.scorer import score_description
from ..parser import parse_frontmatter
from .providers import none as _none
from .score import hit_rate


def _score_variant(text, body, queries):
    lint = score_description(text, body)
    hr = hit_rate(text, queries)
    return {
        "text": text,
        "score": lint["score"],
        "breakdown": lint["breakdown"],
        "hit_rate": hr,
    }


def optimize(skill_dir, opts=None) -> dict:
    opts = opts or {}
    path = Path(skill_dir) / "SKILL.md"
    text = path.read_text(encoding="utf-8")
    parsed = parse_frontmatter(text)
    queries = _none.generate(parsed, opts)

    baseline = _score_variant(parsed.description or "", parsed.body or "", queries)

    variants: list[dict] = []
    if not opts.get("baseline_only"):
        proposed = _none.propose(parsed, opts)
        variants = [
            {**_score_variant(p["text"], parsed.body or "", queries), "rationale": p["rationale"]}
            for p in proposed
        ]
        variants.sort(key=lambda v: v["score"], reverse=True)
        variants = variants[:3]

    return {
        "path": str(path),
        "provider": "none",
        "baseline": baseline,
        "variants": variants,
        "queries": queries,
    }
