from skills_ref.deps.toposort import find_missing_targets, topo_sort
from skills_ref.deps.inversion import check_inversions
from skills_ref.registry import Registry
from skills_ref.types import DepRef


def _dep(name, origin="in_repo", owner=None, repo=None, vr=None):
    return DepRef(name=name, version_range=vr, origin=origin, owner=owner, repo=repo)


def _reg(nodes, edges):
    n = {node["name"]: node for node in nodes}
    e = {}
    for k, deps in edges.items():
        e[k] = [d if isinstance(d, DepRef) else _dep(d) for d in deps]
    return Registry(nodes=n, edges=e)


def test_toposort_empty():
    r = _reg([], {})
    assert topo_sort(r) == {"order": [], "cycles": []}


def test_toposort_single():
    r = _reg([{"name": "a", "tier": "org"}], {})
    assert topo_sort(r) == {"order": ["a"], "cycles": []}


def test_toposort_linear_chain():
    r = _reg(
        [
            {"name": "a", "tier": "team"},
            {"name": "b", "tier": "team"},
            {"name": "c", "tier": "team"},
        ],
        {"a": ["b"], "b": ["c"]},
    )
    result = topo_sort(r)
    assert result["cycles"] == []
    order = result["order"]
    assert order.index("c") < order.index("b") < order.index("a")


def test_toposort_diamond():
    r = _reg(
        [
            {"name": "a", "tier": "team"},
            {"name": "b", "tier": "team"},
            {"name": "c", "tier": "team"},
            {"name": "d", "tier": "team"},
        ],
        {"a": ["b", "c"], "b": ["d"], "c": ["d"]},
    )
    result = topo_sort(r)
    assert result["cycles"] == []
    order = result["order"]
    assert order.index("d") < order.index("b")
    assert order.index("d") < order.index("c")
    assert order.index("b") < order.index("a")
    assert order.index("c") < order.index("a")


def test_toposort_simple_cycle():
    r = _reg(
        [{"name": "a", "tier": "team"}, {"name": "b", "tier": "team"}],
        {"a": ["b"], "b": ["a"]},
    )
    result = topo_sort(r)
    assert len(result["cycles"]) >= 1
    cyc = result["cycles"][0]
    assert cyc[0] == cyc[-1]


def test_toposort_three_cycle():
    r = _reg(
        [
            {"name": "a", "tier": "team"},
            {"name": "b", "tier": "team"},
            {"name": "c", "tier": "team"},
        ],
        {"a": ["b"], "b": ["c"], "c": ["a"]},
    )
    result = topo_sort(r)
    assert len(result["cycles"]) >= 1
    cyc = result["cycles"][0]
    assert cyc[0] == cyc[-1]
    assert len(set(cyc)) == 3


def test_missing_targets_flags_in_repo():
    r = _reg([{"name": "a", "tier": "team"}], {"a": ["b"]})
    assert find_missing_targets(r) == [{"from": "a", "to": "b"}]


def test_missing_targets_ignores_cross_repo():
    r = _reg(
        [{"name": "a", "tier": "team"}],
        {"a": [_dep("x", origin="cross_repo", owner="acme", repo="g")]},
    )
    assert find_missing_targets(r) == []


def test_inversion_org_to_team_flagged():
    r = _reg(
        [{"name": "org-a", "tier": "org"}, {"name": "team-b", "tier": "team"}],
        {"org-a": ["team-b"]},
    )
    assert check_inversions(r) == [
        {"from": "org-a", "to": "team-b", "fromTier": "org", "toTier": "team"}
    ]


def test_inversion_team_to_org_allowed():
    r = _reg(
        [{"name": "team-a", "tier": "team"}, {"name": "org-b", "tier": "org"}],
        {"team-a": ["org-b"]},
    )
    assert check_inversions(r) == []


def test_inversion_ignores_cross_repo():
    r = _reg(
        [{"name": "org-a", "tier": "org"}],
        {"org-a": [_dep("x", origin="cross_repo", owner="acme", repo="g")]},
    )
    assert check_inversions(r) == []
