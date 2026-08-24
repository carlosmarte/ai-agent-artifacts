from __future__ import annotations

WHITE = 0
GREY = 1
BLACK = 2


def topo_sort(registry):
    """Iterative DFS toposort with three-color marking.
    Returns dict: {"order": list[str], "cycles": list[list[str]]}.
    """
    color: dict = {name: WHITE for name in registry.nodes.keys()}
    order: list = []
    cycles: list = []
    stack: list = []

    def visit(start: str) -> None:
        work = [{"node": start, "edges": _clone_deps(registry, start)}]
        while work:
            top = work[-1]
            if color[top["node"]] == WHITE:
                color[top["node"]] = GREY
                stack.append(top["node"])
            if not top["edges"]:
                color[top["node"]] = BLACK
                order.append(top["node"])
                stack.pop()
                work.pop()
                continue
            nxt = top["edges"].pop(0)
            dep = nxt.name
            if dep not in registry.nodes:
                continue
            c = color[dep]
            if c == GREY:
                idx = stack.index(dep)
                cycles.append(stack[idx:] + [dep])
            elif c == WHITE:
                work.append({"node": dep, "edges": _clone_deps(registry, dep)})

    for name in list(registry.nodes.keys()):
        if color[name] == WHITE:
            visit(name)
    return {"order": order, "cycles": cycles}


def _clone_deps(registry, node):
    return sorted(
        list(registry.edges.get(node, [])),
        key=lambda d: d.name or "",
    )


def find_missing_targets(registry) -> list:
    missing = []
    for name, deps in registry.edges.items():
        for dep in deps:
            if dep.origin != "in_repo":
                continue
            if dep.name not in registry.nodes:
                missing.append({"from": name, "to": dep.name})
    return missing
