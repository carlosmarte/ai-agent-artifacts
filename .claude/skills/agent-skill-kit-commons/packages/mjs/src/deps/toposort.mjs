const WHITE = 0;
const GREY = 1;
const BLACK = 2;

/**
 * Iterative DFS toposort with three-color marking. Cycles are captured as the
 * smallest closed walks that triggered each back-edge.
 * Order is reverse-post-order: leaves first, roots last.
 * Returns: { order: string[], cycles: string[][] }.
 */
export function topoSort(registry) {
  const color = new Map();
  const order = [];
  const cycles = [];
  const stack = [];

  for (const name of registry.nodes.keys()) color.set(name, WHITE);

  function visit(start) {
    const work = [{ node: start, edges: cloneDeps(registry, start) }];
    while (work.length) {
      const top = work[work.length - 1];
      if (color.get(top.node) === WHITE) {
        color.set(top.node, GREY);
        stack.push(top.node);
      }
      const next = top.edges.shift();
      if (next === undefined) {
        color.set(top.node, BLACK);
        order.push(top.node);
        stack.pop();
        work.pop();
        continue;
      }
      const dep = next.name;
      if (!registry.nodes.has(dep)) continue; // missing target handled elsewhere
      const c = color.get(dep);
      if (c === GREY) {
        const idx = stack.indexOf(dep);
        cycles.push(stack.slice(idx).concat(dep));
      } else if (c === WHITE) {
        work.push({ node: dep, edges: cloneDeps(registry, dep) });
      }
    }
  }

  // Iterate node keys in sorted order for deterministic tie-break.
  const names = [...registry.nodes.keys()];
  for (const name of names) {
    if (color.get(name) === WHITE) visit(name);
  }
  return { order, cycles };
}

function cloneDeps(registry, node) {
  const list = registry.edges.get(node) ?? [];
  // Sort by dep name for deterministic order across runtimes.
  return [...list].sort((a, b) =>
    (a.name ?? "") < (b.name ?? "") ? -1 : (a.name ?? "") > (b.name ?? "") ? 1 : 0,
  );
}

/**
 * Detect missing in-repo dependency targets.
 * Returns an array of { from, to } pairs.
 */
export function findMissingTargets(registry) {
  const missing = [];
  for (const [name, deps] of registry.edges) {
    for (const dep of deps) {
      if (dep.origin !== "in_repo") continue;
      if (!registry.nodes.has(dep.name)) {
        missing.push({ from: name, to: dep.name });
      }
    }
  }
  return missing;
}
