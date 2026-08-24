from __future__ import annotations

from skills_ref.rules.references import check_references

from .neutrality import check_vendor_neutrality
from .scorer import load_assets, score_description


def lint(parsed, skill_dir) -> dict:
    r = score_description(parsed.description, parsed.body)
    score = r["score"]
    breakdown = r["breakdown"]
    warnings = r["warnings"]
    issues: list = []
    issues.extend(check_vendor_neutrality(parsed))
    ref_issues = check_references(parsed, skill_dir)
    for i in ref_issues:
        issues.append(_issue_to_dict(i))
    for w in warnings:
        issues.append(
            {
                "code": "L002_DESCRIPTION_QUALITY",
                "severity": "warn",
                "field": "description",
                "message": w,
            }
        )
    return {"score": score, "breakdown": breakdown, "issues": issues}


def _issue_to_dict(i) -> dict:
    if hasattr(i, "to_dict"):
        d = i.to_dict()
    elif isinstance(i, dict):
        d = dict(i)
    else:
        d = {
            "code": getattr(i, "code", ""),
            "severity": getattr(i, "severity", ""),
            "field": getattr(i, "field", ""),
            "message": getattr(i, "message", ""),
        }
    # Drop nulls / non-applicable keys for cleaner JSON parity with mjs.
    d.pop("source_offset", None)
    return d


__all__ = [
    "lint",
    "score_description",
    "load_assets",
    "check_vendor_neutrality",
]
