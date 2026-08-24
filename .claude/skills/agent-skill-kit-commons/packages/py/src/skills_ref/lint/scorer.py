from __future__ import annotations

import re
from pathlib import Path

_ASSETS_DIR = Path(__file__).resolve().parent.parent / "assets"

_CACHED: dict | None = None


def load_assets() -> dict:
    global _CACHED
    if _CACHED is not None:
        return _CACHED

    def _read(name: str) -> list[str]:
        return [
            s.strip()
            for s in (_ASSETS_DIR / name).read_text(encoding="utf-8").split("\n")
            if s.strip()
        ]

    _CACHED = {
        "vague": [s.lower() for s in _read("vague_phrases.txt")],
        "verbs": {s.lower() for s in _read("action_verbs.txt")},
        "stop": {s.lower() for s in _read("stop_words.txt")},
    }
    return _CACHED


def _tokenize(text: str | None) -> list[str]:
    if not text:
        return []
    return [t for t in re.split(r"\W+", text.lower()) if t]


def _round_half_up(x: float) -> int:
    """Mirror JS Math.round (round half toward +inf for positives)."""
    return int(x + 0.5) if x >= 0 else -int(-x + 0.5)


_TRIGGER_RE = re.compile(r"\b(?:use when|when |if |for )")


def score_description(description: str | None, body: str | None) -> dict:
    assets = load_assets()
    vague = assets["vague"]
    verbs = assets["verbs"]
    stop = assets["stop"]

    desc = (description or "").lower()
    tokens = _tokenize(desc)
    body_tokens = [t for t in _tokenize(body) if t not in stop]
    body_set = set(body_tokens)

    # 1. Keyword density (0-25)
    desc_keywords = [t for t in tokens if t not in stop]
    overlap = sum(1 for t in desc_keywords if t in body_set)
    denom = max(1, len(desc_keywords))
    keyword_density = min(25, _round_half_up((overlap / denom) * 25))

    # 2. Action verbs (0-20)
    first_verb = 12 if tokens and tokens[0] in verbs else 0
    any_verb = 8 if any(t in verbs for t in tokens) else 0
    action_verbs = min(20, first_verb + any_verb)

    # 3. Trigger phrases (0-20)
    trigger_phrases = 20 if _TRIGGER_RE.search(desc) else 0

    # 4. Specificity (0-20)
    vague_hits = [p for p in vague if p in desc]
    specificity = max(0, 20 - len(vague_hits) * 5)

    # 5. Length sweet spot (0-15)
    raw = description or ""
    ln = len(raw)
    if ln < 60:
        length = _round_half_up((ln / 60) * 15)
    elif ln > 300:
        length = max(0, 15 - _round_half_up((ln - 300) / 50))
    else:
        length = 15

    score = min(
        100,
        keyword_density + action_verbs + trigger_phrases + specificity + length,
    )

    warnings: list[str] = []
    if vague_hits:
        warnings.append(f"vague phrases found: {', '.join(vague_hits)}")
    if first_verb == 0:
        warnings.append("description does not lead with an action verb")
    if trigger_phrases == 0:
        warnings.append(
            "description lacks a trigger phrase ('when', 'if', 'use when', 'for')"
        )

    return {
        "score": score,
        "breakdown": {
            "keywordDensity": keyword_density,
            "actionVerbs": action_verbs,
            "triggerPhrases": trigger_phrases,
            "specificity": specificity,
            "length": length,
        },
        "warnings": warnings,
    }
