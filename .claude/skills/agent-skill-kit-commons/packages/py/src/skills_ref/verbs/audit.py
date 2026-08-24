from __future__ import annotations

from pathlib import Path

from ..audit.deps_origin import audit_dep_origins
from ..audit.frontmatter import audit_frontmatter
from ..audit.path_leak import audit_path_leak
from ..audit.printer import format_audit
from ..audit.scripts import audit_scripts
from ..registry import build_registry

PASSES = frozenset({"frontmatter", "scripts", "deps", "path-leak"})


def audit(args) -> tuple[int, str]:
    root = Path(args.path).resolve()
    reg = build_registry(str(root))
    allowed_origins = None
    if getattr(args, "allowed_origins", None):
        allowed_origins = [
            s.strip() for s in args.allowed_origins.split(",") if s.strip()
        ]
    skip = set()
    if getattr(args, "skip", None):
        for s in args.skip.split(","):
            s = s.strip()
            if s in PASSES:
                skip.add(s)
    findings = []
    if "frontmatter" not in skip:
        findings.extend(audit_frontmatter(reg))
    if "scripts" not in skip:
        findings.extend(audit_scripts(reg))
    if "deps" not in skip:
        findings.extend(audit_dep_origins(reg, allowed_origins=allowed_origins))
    if "path-leak" not in skip:
        findings.extend(audit_path_leak(reg))

    counts = {"HIGH": 0, "MEDIUM": 0, "LOW": 0}
    for f in findings:
        if f.get("severity") in counts:
            counts[f["severity"]] += 1
    exit_code = 0
    if counts["HIGH"] > 0:
        exit_code = 1
    elif getattr(args, "strict", False) and counts["MEDIUM"] > 0:
        exit_code = 1
    return exit_code, format_audit(findings, args.format)
