from __future__ import annotations

from skills_ref.prompt.budget import truncate_to_budget


def _e(name, desc="x"):
    return {"name": name, "tier": "org", "description": desc}


def test_no_budget_returns_all():
    entries = [_e("a"), _e("b"), _e("c")]
    kept, dropped = truncate_to_budget(entries, None)
    assert kept == entries
    assert dropped == 0
    kept, dropped = truncate_to_budget(entries, 0)
    assert kept == entries
    assert dropped == 0


def test_empty_entries():
    kept, dropped = truncate_to_budget([], 999)
    assert kept == []
    assert dropped == 0


def test_drops_trailing_entries_when_exceeded():
    entries = [_e(f"s{i}", "x" * 20) for i in range(10)]
    kept, dropped = truncate_to_budget(entries, 30)
    assert 0 < len(kept) < len(entries)
    assert dropped == len(entries) - len(kept)


def test_dropped_plus_kept_equals_total():
    entries = [_e(f"s{i}") for i in range(5)]
    kept, dropped = truncate_to_budget(entries, 25)
    assert dropped + len(kept) == len(entries)
