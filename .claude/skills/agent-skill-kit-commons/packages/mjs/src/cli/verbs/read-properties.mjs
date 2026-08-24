import { statSync } from "node:fs";
import { resolve, join } from "node:path";
import {
  MalformedFrontmatterError,
  MissingFrontmatterError,
} from "../../parser.mjs";
import {
  readProperties,
  readPropertiesRoot,
} from "../../prompt/read_properties.mjs";

function parseArgs(args) {
  const opts = { path: null, rootMode: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--root") {
      opts.rootMode = true;
      const v = args[++i];
      if (v && !v.startsWith("--")) opts.path = v;
    } else if (!a.startsWith("--") && opts.path == null) {
      opts.path = a;
    }
  }
  return opts;
}

function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    const o = {};
    for (const k of Object.keys(v).sort()) o[k] = sortKeys(v[k]);
    return o;
  }
  return v;
}

export async function readPropertiesVerb(args) {
  const opts = parseArgs(args);
  if (!opts.path) {
    return {
      exitCode: 64,
      output:
        "usage: skills-ref read-properties <skill-dir> | --root <root-dir>\n",
    };
  }
  let target;
  try {
    target = resolve(opts.path);
    statSync(target);
  } catch {
    return { exitCode: 2, output: `no SKILL.md found under: ${opts.path}\n` };
  }

  if (opts.rootMode) {
    let arr;
    try {
      arr = readPropertiesRoot(target);
    } catch (e) {
      return { exitCode: 1, output: `read-properties: ${e.message}\n` };
    }
    if (arr.length === 0) {
      return { exitCode: 2, output: `no SKILL.md found under: ${opts.path}\n` };
    }
    return {
      exitCode: 0,
      output: JSON.stringify(arr.map(sortKeys), null, 2) + "\n",
    };
  }

  // single-skill mode: target must be a directory containing SKILL.md
  let st;
  try {
    st = statSync(target);
  } catch {
    return { exitCode: 2, output: `no SKILL.md found under: ${opts.path}\n` };
  }
  if (!st.isDirectory()) {
    return { exitCode: 2, output: `no SKILL.md found under: ${opts.path}\n` };
  }
  try {
    statSync(join(target, "SKILL.md"));
  } catch {
    return { exitCode: 2, output: `no SKILL.md found under: ${opts.path}\n` };
  }
  let obj;
  try {
    obj = readProperties(target);
  } catch (e) {
    if (
      e instanceof MissingFrontmatterError ||
      e instanceof MalformedFrontmatterError
    ) {
      return { exitCode: 1, output: `read-properties: ${e.message}\n` };
    }
    return { exitCode: 1, output: `read-properties: ${e.message}\n` };
  }
  return { exitCode: 0, output: JSON.stringify(sortKeys(obj), null, 2) + "\n" };
}
