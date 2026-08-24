from __future__ import annotations

import argparse
import sys

from .verbs.audit import audit as _audit
from .verbs.deps import deps as _deps
from .verbs.lint import lint as _lint
from .verbs.optimize import optimize as _optimize
from .verbs.read_properties import read_properties_verb as _read_properties
from .verbs.to_prompt import to_prompt as _to_prompt
from .verbs.validate import validate as _validate

HELP_TEXT = """skills-ref - Agent Skills validator/linter/auditor toolkit

Usage:
  skills-ref <verb> [args] [flags]

Verbs:
  validate <path>          Validate one skill or a tree of skills.
  deps <path>              Resolve dependency DAG, detect cycles. (Feature 03)
  audit <path>             Run defensive security passes. (Feature 03)
  lint <path>              Score description, flag vague language. (Feature 04)
  to-prompt <path>         Emit <available_skills> XML block. (Feature 05)
  read-properties <path>   Emit per-skill frontmatter as canonical JSON. (Feature 05)
  optimize <path>          Propose description rewrites. (Feature 06)
"""


def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="skills-ref", add_help=False)
    p.add_argument("-h", "--help", action="store_true")
    p.add_argument("-V", "--version", action="store_true")
    sub = p.add_subparsers(dest="verb")

    val = sub.add_parser("validate", add_help=False)
    val.add_argument("path")
    val.add_argument("--format", choices=["human", "json"], default="human")
    val.add_argument("--no-color", action="store_true")
    val.add_argument("--extra-tiers", default="")
    val.add_argument("--strict", action="store_true")

    dep = sub.add_parser("deps", add_help=False)
    dep.add_argument("path")
    dep.add_argument("--format", choices=["human", "json"], default="human")
    dep.add_argument("--strict", action="store_true")
    dep.add_argument("--extra-tiers", default="")

    aud = sub.add_parser("audit", add_help=False)
    aud.add_argument("path")
    aud.add_argument("--format", choices=["human", "json"], default="human")
    aud.add_argument("--strict", action="store_true")
    aud.add_argument("--allowed-origins", default="")
    aud.add_argument("--skip", default="")

    lnt = sub.add_parser("lint", add_help=False)
    lnt.add_argument("path")
    lnt.add_argument("--format", choices=["human", "json"], default="human")
    lnt.add_argument("--explain", action="store_true")
    lnt.add_argument("--min-score", type=int, default=40, dest="min_score")

    tp = sub.add_parser("to-prompt", add_help=False)
    tp.add_argument("path")
    tp.add_argument("--max-tokens", type=int, default=None, dest="max_tokens")
    tp.add_argument("--include-invalid", action="store_true", dest="include_invalid")
    tp.add_argument("--format", default="xml")

    rp = sub.add_parser("read-properties", add_help=False)
    rp.add_argument("path")
    rp.add_argument("--root", action="store_true", dest="root_mode")

    opt = sub.add_parser("optimize", add_help=False)
    opt.add_argument("path")
    opt.add_argument("--format", choices=["human", "json"], default="human")
    opt.add_argument("--baseline-only", action="store_true", dest="baseline_only")
    opt.add_argument("--apply", type=int, default=None)
    opt.add_argument("--query-count", type=int, default=8, dest="query_count")
    return p


VERBS = {
    "validate": _validate,
    "deps": _deps,
    "audit": _audit,
    "lint": _lint,
    "to-prompt": _to_prompt,
    "read-properties": _read_properties,
    "optimize": _optimize,
}


def main(argv=None) -> int:
    parser = _build_parser()
    args, _rest = parser.parse_known_args(argv)
    if args.help or not args.verb:
        sys.stdout.write(HELP_TEXT)
        return 0
    if args.version:
        sys.stdout.write("skills-ref 0.0.1\n")
        return 0
    fn = VERBS.get(args.verb)
    if fn is None:
        sys.stdout.write(f"unknown verb: {args.verb}\n")
        return 64
    exit_code, output = fn(args)
    if output:
        sys.stdout.write(output)
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
