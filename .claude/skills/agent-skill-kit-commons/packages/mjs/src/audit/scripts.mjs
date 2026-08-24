import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PATTERNS_PATH = resolve(__dirname, "..", "..", "assets", "injection_patterns.json");

let _patterns = null;
function loadPatterns() {
  if (_patterns) return _patterns;
  const raw = JSON.parse(readFileSync(PATTERNS_PATH, "utf8"));
  _patterns = raw.map((p) => ({
    id: p.id,
    re: new RegExp(p.pattern),
    languages: new Set(p.languages),
  }));
  return _patterns;
}

function walkScripts(scriptsDir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(scriptsDir, { withFileTypes: true });
  } catch {
    return out;
  }
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const entry of entries) {
    const p = join(scriptsDir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkScripts(p));
    } else if (entry.isFile()) {
      out.push(p);
    }
  }
  return out;
}

/**
 * Scan every file under each skill's scripts/ for canonical command-injection
 * patterns. Each match emits HIGH A010_COMMAND_INJECTION_PATTERN with
 * `path:line` (1-indexed) provenance.
 */
export function auditScripts(registry) {
  const patterns = loadPatterns();
  const findings = [];
  for (const [, node] of registry.nodes) {
    if (!node.dir) continue;
    const scriptsDir = join(node.dir, "scripts");
    let stat;
    try {
      stat = statSync(scriptsDir);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) continue;
    for (const file of walkScripts(scriptsDir)) {
      const ext = extname(file);
      const applicable = patterns.filter((p) => p.languages.has(ext));
      if (applicable.length === 0) continue;
      let text;
      try {
        text = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      const lines = text.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const p of applicable) {
          if (p.re.test(line)) {
            findings.push({
              severity: "HIGH",
              code: "A010_COMMAND_INJECTION_PATTERN",
              where: `${file}:${i + 1}`,
              message: `command-injection pattern '${p.id}' matched: ${line.trim()}`,
            });
          }
        }
      }
    }
  }
  return findings;
}
