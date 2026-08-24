from skills_ref.deps.conflict import check_conflicts, check_unpinned
from skills_ref.deps.range import intersects, parse_range
from skills_ref.registry import Registry
from skills_ref.types import DepRef


def test_parse_caret():
    assert parse_range("^1.2.3") == {
        "op": "caret",
        "min": [1, 2, 3],
        "max_exclusive": [2, 0, 0],
    }


def test_parse_tilde():
    assert parse_range("~1.2.3") == {
        "op": "tilde",
        "min": [1, 2, 3],
        "max_exclusive": [1, 3, 0],
    }


def test_parse_exact():
    assert parse_range("1.2.3") == {
        "op": "exact",
        "min": [1, 2, 3],
        "max_exclusive": [1, 2, 4],
    }


def test_parse_bounded():
    assert parse_range(">=1.0.0 <2.0.0") == {
        "op": "bounded",
        "min": [1, 0, 0],
        "max_exclusive": [2, 0, 0],
    }


def test_parse_any():
    assert parse_range(None) == {"op": "any"}
    assert parse_range("") == {"op": "any"}


def test_intersects_overlap():
    assert intersects(parse_range("^1.0.0"), parse_range("^1.5.0"))


def test_intersects_disjoint():
    assert not intersects(parse_range("^1.0.0"), parse_range("^2.0.0"))


def test_intersects_adjacent_tilde():
    assert not intersects(parse_range("~1.2.0"), parse_range("~1.3.0"))


def test_intersects_with_any():
    assert intersects(parse_range(None), parse_range("^1.0.0"))


def _reg(edges_list):
    nodes = {f: {"name": f, "tier": "team"} for f, _ in edges_list}
    edges = {
        f: [
            DepRef(
                name=d["name"],
                version_range=d.get("version_range"),
                origin="in_repo",
                owner=None,
                repo=None,
            )
            for d in deps
        ]
        for f, deps in edges_list
    }
    return Registry(nodes=nodes, edges=edges)


def test_e020_on_incompatible_ranges():
    r = _reg(
        [
            ("caller-a", [{"name": "dep", "version_range": "^1.0.0"}]),
            ("caller-b", [{"name": "dep", "version_range": "^2.0.0"}]),
        ]
    )
    issues = check_conflicts(r)
    assert len(issues) == 1
    assert issues[0]["code"] == "E020_CONFLICTING_RANGES"
    assert "caller-a" in issues[0]["message"]
    assert "caller-b" in issues[0]["message"]


def test_no_conflict_on_compatible_ranges():
    r = _reg(
        [
            ("caller-a", [{"name": "dep", "version_range": "^1.0.0"}]),
            ("caller-b", [{"name": "dep", "version_range": "^1.5.0"}]),
        ]
    )
    assert check_conflicts(r) == []


def test_w020_unpinned():
    r = _reg([("caller-a", [{"name": "dep"}])])
    issues = check_unpinned(r)
    assert len(issues) == 1
    assert issues[0]["code"] == "W020_UNPINNED_DEPENDENCY"
    assert "caller-a" in issues[0]["message"]
    assert "dep/v<X.Y.Z>" in issues[0]["message"]
