from __future__ import annotations

_HEADER_FOOTER_CHARS = len("<available_skills>\n</available_skills>\n")
_PER_ENTRY_OVERHEAD = len('  <skill name="" tier=""></skill>\n')


def truncate_to_budget(entries, max_tokens):
    if not max_tokens:
        return list(entries), 0
    max_chars = max_tokens * 4
    used = _HEADER_FOOTER_CHARS
    kept = []
    for e in entries:
        cost = (
            _PER_ENTRY_OVERHEAD
            + len(e.get("name") or "")
            + len(e.get("tier") or "")
            + len(e.get("description") or "")
        )
        if used + cost > max_chars:
            break
        used += cost
        kept.append(e)
    return kept, len(entries) - len(kept)
