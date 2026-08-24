from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from ..parser import parse_frontmatter
from ..rules.naming import check_naming


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="check-naming")
    parser.add_argument("--fixture", required=True)
    parser.add_argument("--extra-tiers", default="")
    args = parser.parse_args(argv)
    p = Path(args.fixture).resolve()
    parsed = parse_frontmatter((p / "SKILL.md").read_text(encoding="utf-8"))
    extra = [t.strip() for t in args.extra_tiers.split(",") if t.strip()]
    issues = check_naming(parsed, p.name, {"extra_tiers": extra})
    sys.stdout.write(
        json.dumps([i.to_dict() for i in issues], sort_keys=True, separators=(",", ":"))
        + "\n"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
