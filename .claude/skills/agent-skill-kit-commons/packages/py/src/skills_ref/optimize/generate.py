from __future__ import annotations

import re
from pathlib import Path

_ASSETS_DIR = Path(__file__).resolve().parent.parent / "assets"

_VERB_RE = re.compile(
    r"\b(scaffold|validate|audit|score|emit|resolve|lint|optimize|export|generate|sort|detect|warn|run|build|parse|check|wire|install|configure|rewrite|propose|tune)\b"
)
_NOUN_RE = re.compile(
    r"\b(skill|frontmatter|description|dependency|dependencies|registry|prompt|properties|graph|cycle|inversion|tier|fixture|workflow|hook|gate|comment|provider|variant|hit-rate|score|optimizer|integrator)\b"
)

_bank = None


def _load_negative_bank() -> list[str]:
    global _bank
    if _bank is not None:
        return _bank
    text = (_ASSETS_DIR / "negative_query_bank.txt").read_text(encoding="utf-8")
    _bank = [s.strip() for s in text.split("\n") if s.strip()]
    return _bank


def _unique(arr):
    seen = set()
    out = []
    for x in arr:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out


def extract_verbs_and_nouns(parsed) -> tuple[list[str], list[str]]:
    body = (parsed.body or "").lower()
    desc = (parsed.description or "").lower()
    verbs = _unique(_VERB_RE.findall(body) + _VERB_RE.findall(desc))
    nouns = _unique(_NOUN_RE.findall(desc) + _NOUN_RE.findall(body))
    return verbs, nouns


def generate_deterministic(parsed, n: int = 8) -> dict:
    verbs, nouns = extract_verbs_and_nouns(parsed)
    positive: list[str] = []
    for i in range(n):
        v = verbs[i % max(1, len(verbs))] if verbs else "do"
        noun = nouns[i % max(1, len(nouns))] if nouns else "thing"
        positive.append(f"{v} the {noun}")
    bank = _load_negative_bank()
    negative = bank[:n]
    return {"positive": positive, "negative": negative}
