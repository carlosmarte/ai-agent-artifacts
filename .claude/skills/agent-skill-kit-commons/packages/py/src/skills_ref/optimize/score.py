from __future__ import annotations

import re

from ..lint.scorer import load_assets


def _tokenize(text: str) -> list[str]:
    return [t for t in re.split(r"\W+", (text or "").lower()) if t]


def _content_words(text: str, stop: set) -> list[str]:
    return [t for t in _tokenize(text) if t not in stop]


def _matches(query: str, desc_words: set, stop: set) -> bool:
    qw = _content_words(query, stop)
    if not qw:
        return False
    return any(w in desc_words for w in qw)


def hit_rate(description: str, queries: dict) -> dict:
    assets = load_assets()
    stop = assets["stop"]
    desc_words = set(_content_words(description or "", stop))
    positive = queries.get("positive", []) or []
    negative = queries.get("negative", []) or []
    positive_hits = sum(1 for q in positive if _matches(q, desc_words, stop))
    false_positives = sum(1 for q in negative if _matches(q, desc_words, stop))
    positive_total = len(positive)
    false_total = len(negative)
    tp_rate = (positive_hits / positive_total) if positive_total else 0
    fp_rate = (false_positives / false_total) if false_total else 0
    raw = (tp_rate - fp_rate) * 100
    # round-half-up (match JS Math.round) — avoids Python's banker's rounding
    rounded = int(raw + 0.5) if raw >= 0 else -int((-raw) + 0.5)
    score = max(0, min(100, rounded))
    return {
        "positive_hits": positive_hits,
        "positive_total": positive_total,
        "false_positives": false_positives,
        "false_total": false_total,
        "score": score,
    }
