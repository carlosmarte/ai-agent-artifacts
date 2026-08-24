from __future__ import annotations

import re

from ..lint.scorer import load_assets
from .generate import extract_verbs_and_nouns


def _strip_vague_phrases(description: str, vague: list[str]) -> str:
    out = description
    for v in vague:
        pat = r"\b" + re.escape(v) + r"\b"
        out = re.sub(pat, "", out, flags=re.IGNORECASE)
        out = re.sub(r"\s+", " ", out).strip()
    return out


def _leads_with_verb(description: str, verbs: set) -> bool:
    first = re.split(r"\W+", (description or "").strip())[0].lower() if description else ""
    return bool(first) and first in verbs


def _pick_anchor_verb(parsed, verbs: set):
    candidate_verbs, _ = extract_verbs_and_nouns(parsed)
    for v in candidate_verbs:
        if v in verbs:
            return v
    for v in [
        "scaffold",
        "validate",
        "audit",
        "score",
        "emit",
        "resolve",
        "lint",
        "optimize",
        "generate",
    ]:
        if v in verbs:
            return v
    return None


def _ensure_trigger_phrase(description: str, parsed) -> str:
    if re.search(r"\b(use when|when |if |for )", description, flags=re.IGNORECASE):
        return description
    _, nouns = extract_verbs_and_nouns(parsed)
    noun = nouns[0] if nouns else "skill"
    return description.rstrip() + f" Use when the user asks to work with the {noun}."


def _clamp_length(description: str, low: int = 60, high: int = 300) -> str:
    if low <= len(description) <= high:
        return description
    if len(description) > high:
        cut = description[: high - 1]
        last_space = cut.rfind(" ")
        trimmed = cut[:last_space] if last_space > 0 else cut
        trimmed = re.sub(r"[,;:.]+$", "", trimmed)
        return trimmed + "."
    return description


def _capitalize(s: str) -> str:
    if not s:
        return s
    return s[0].upper() + s[1:]


def propose_variants_deterministic(parsed) -> list[dict]:
    assets = load_assets()
    vague = assets["vague"]
    verbs = assets["verbs"]
    base = (parsed.description or "").strip()
    anchor = _pick_anchor_verb(parsed, verbs)

    # Variant 0
    v0 = base
    if anchor and not _leads_with_verb(v0, verbs):
        v0 = _capitalize(anchor) + " " + (v0[0].lower() + v0[1:] if v0 else "")
    v0 = _ensure_trigger_phrase(v0, parsed)
    v0 = _clamp_length(v0)

    # Variant 1
    v1 = _strip_vague_phrases(base, vague)
    if anchor and not _leads_with_verb(v1, verbs):
        v1 = _capitalize(anchor) + " " + (v1[0].lower() + v1[1:] if v1 else "")
    v1 = _ensure_trigger_phrase(v1, parsed)
    v1 = _clamp_length(v1)

    # Variant 2
    v2 = _clamp_length(_strip_vague_phrases(base, vague))
    if anchor and not _leads_with_verb(v2, verbs):
        v2 = _capitalize(anchor) + " " + (v2[0].lower() + v2[1:] if v2 else "")
    v2 = _ensure_trigger_phrase(v2, parsed)
    v2 = _clamp_length(v2)

    return [
        {"text": v0, "rationale": "lead-with-verb + append trigger phrase"},
        {"text": v1, "rationale": "strip vague phrases + lead-with-verb + trigger"},
        {"text": v2, "rationale": "length-tighten + scrub + verb + trigger"},
    ]
