from __future__ import annotations


def audit_dep_origins(registry, allowed_origins=None) -> list:
    findings = []
    allow_set = set(allowed_origins) if allowed_origins else None
    for name, deps in registry.edges.items():
        for dep in deps:
            if dep.origin != "cross_repo":
                continue
            owner = dep.owner or ""
            if allow_set is None:
                findings.append(
                    {
                        "severity": "MEDIUM",
                        "code": "A020_UNVETTED_ORIGIN",
                        "where": f"{name}:dependencies",
                        "message": (
                            f"cross-repo dependency '{owner}/{dep.repo}#{dep.name}' "
                            f"has no allowlist (run with --allowed-origins to enforce)"
                        ),
                    }
                )
            elif owner not in allow_set:
                findings.append(
                    {
                        "severity": "HIGH",
                        "code": "A020_UNVETTED_ORIGIN",
                        "where": f"{name}:dependencies",
                        "message": f"cross-repo dependency owner '{owner}' not in --allowed-origins",
                    }
                )
    return findings
