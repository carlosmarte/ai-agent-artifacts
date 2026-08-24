from __future__ import annotations

from ..generate import generate_deterministic
from ..rewrite import propose_variants_deterministic

PROVIDER_NAME = "none"


def generate(parsed, opts):
    return generate_deterministic(parsed, opts.get("query_count", 8))


def propose(parsed, opts=None):
    return propose_variants_deterministic(parsed)
