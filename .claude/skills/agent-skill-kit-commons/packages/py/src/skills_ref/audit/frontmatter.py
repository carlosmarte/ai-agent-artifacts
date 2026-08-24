from __future__ import annotations

ALLOWED_TOP_LEVEL = frozenset(
    {
        "name",
        "description",
        "tier",
        "license",
        "compatibility",
        "metadata",
        "allowed-tools",
        "dependencies",
    }
)


def audit_frontmatter(registry) -> list:
    findings = []
    for name, node in registry.nodes.items():
        if node.get("parse_error"):
            continue
        raw = node.get("raw_frontmatter") or {}
        if not isinstance(raw, dict):
            continue
        for key in sorted(raw.keys()):
            if key not in ALLOWED_TOP_LEVEL:
                findings.append(
                    {
                        "severity": "MEDIUM",
                        "code": "A001_UNAUTHORIZED_FIELD",
                        "where": f"{node['dir']}/SKILL.md:{key}",
                        "message": (
                            f"unauthorized top-level frontmatter field '{key}'; "
                            f"move under 'metadata' to preserve vendor-neutrality"
                        ),
                    }
                )
    return findings
