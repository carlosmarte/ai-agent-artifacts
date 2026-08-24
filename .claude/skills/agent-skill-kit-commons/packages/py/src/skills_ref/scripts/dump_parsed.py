from __future__ import annotations

import argparse
import sys
from pathlib import Path

from ..parser import parse_frontmatter, to_canonical_json


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="dump-parsed")
    parser.add_argument("--fixture", required=True)
    args = parser.parse_args(argv)
    p = Path(args.fixture)
    skill = p if p.name == "SKILL.md" else p / "SKILL.md"
    parsed = parse_frontmatter(skill.read_text(encoding="utf-8"))
    data = parsed.to_dict()
    body = data.pop("body", "")
    data["body_lines"] = len(body.split("\n"))
    sys.stdout.write(to_canonical_json(data) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
