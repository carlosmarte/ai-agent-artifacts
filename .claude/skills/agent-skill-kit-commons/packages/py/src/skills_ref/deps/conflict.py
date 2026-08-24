from __future__ import annotations

from .range import intersects, parse_range


def check_conflicts(registry) -> list:
    grouped: dict = {}
    for caller, deps in registry.edges.items():
        for dep in deps:
            if dep.origin != "in_repo" or not dep.version_range:
                continue
            grouped.setdefault(dep.name, []).append(
                {
                    "caller": caller,
                    "range_str": dep.version_range,
                    "range": parse_range(dep.version_range),
                }
            )
    issues: list = []
    for dep_name in sorted(grouped.keys()):
        callers = grouped[dep_name]
        for i in range(len(callers)):
            for j in range(i + 1, len(callers)):
                if not intersects(callers[i]["range"], callers[j]["range"]):
                    issues.append(
                        {
                            "code": "E020_CONFLICTING_RANGES",
                            "severity": "error",
                            "field": "dependencies",
                            "message": (
                                f"incompatible ranges for '{dep_name}': "
                                f"{callers[i]['caller']} requires {callers[i]['range_str']}, "
                                f"{callers[j]['caller']} requires {callers[j]['range_str']}"
                            ),
                        }
                    )
    return issues


def check_unpinned(registry) -> list:
    issues: list = []
    for caller, deps in registry.edges.items():
        for dep in deps:
            if dep.origin == "in_repo" and not dep.version_range:
                issues.append(
                    {
                        "code": "W020_UNPINNED_DEPENDENCY",
                        "severity": "warn",
                        "field": "dependencies",
                        "message": (
                            f"{caller}: unpinned dependency '{dep.name}'; "
                            f"pin against tag '{dep.name}/v<X.Y.Z>'"
                        ),
                    }
                )
    return issues
