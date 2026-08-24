import { resolve } from "node:path";
import { buildRegistry } from "../../registry.mjs";
import { topoSort, findMissingTargets } from "../../deps/toposort.mjs";
import { serializeAvailableSkills } from "../../prompt/xml.mjs";
import { truncateToBudget } from "../../prompt/budget.mjs";

function parseArgs(args) {
  const opts = {
    path: null,
    maxTokens: null,
    includeInvalid: false,
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--max-tokens") {
      const v = args[++i];
      const n = parseInt(v, 10);
      if (!Number.isNaN(n) && n > 0) opts.maxTokens = n;
    } else if (a === "--include-invalid") {
      opts.includeInvalid = true;
    } else if (a === "--format") {
      // accepted for forward-compat; only "xml" supported
      i++;
    } else if (!a.startsWith("--") && opts.path == null) {
      opts.path = a;
    }
  }
  return opts;
}

export async function toPromptVerb(args) {
  const opts = parseArgs(args);
  if (!opts.path) {
    return {
      exitCode: 64,
      output:
        "usage: skills-ref to-prompt <root> [--max-tokens N] [--include-invalid]\n",
    };
  }
  const root = resolve(opts.path);
  const reg = buildRegistry(root);
  if (reg.nodes.size === 0) {
    return { exitCode: 2, output: `no SKILL.md found under: ${opts.path}\n` };
  }
  const { order, cycles } = topoSort(reg);
  if (cycles.length > 0) {
    const msg = cycles
      .map((c) => `cycle: ${c.join(" -> ")}`)
      .join("\n");
    return { exitCode: 1, output: `${msg}\n` };
  }
  const missing = findMissingTargets(reg);
  if (missing.length > 0) {
    const msg = missing
      .map((m) => `missing in-repo dep: ${m.from} -> ${m.to}`)
      .join("\n");
    return { exitCode: 1, output: `${msg}\n` };
  }

  const entries = [];
  for (const name of order) {
    const node = reg.nodes.get(name);
    if (!node) continue;
    if (node.parse_error) {
      if (opts.includeInvalid) {
        entries.push({
          name,
          tier: "",
          description: node.parse_error,
          invalid: true,
        });
      }
      continue;
    }
    entries.push({
      name: node.name ?? name,
      tier: node.tier ?? "",
      description: node.description ?? "",
    });
  }
  // Registry yields nodes in sorted-name order; toposort visits in that order.
  // For parse_error nodes that aren't in `order` (they have no edges and may
  // be skipped), surface them when --include-invalid is set.
  if (opts.includeInvalid) {
    const seen = new Set(order);
    for (const [name, node] of reg.nodes) {
      if (seen.has(name)) continue;
      if (!node.parse_error) continue;
      entries.push({
        name,
        tier: "",
        description: node.parse_error,
        invalid: true,
      });
    }
  }

  const { kept, dropped } = truncateToBudget(entries, opts.maxTokens);
  const xml = serializeAvailableSkills({ entries: kept, truncated: dropped });
  return { exitCode: 0, output: xml };
}
