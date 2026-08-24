import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const HOST_PATH_RE = /(\/Users\/|\/home\/|\/tmp\/)/;

function walkAll(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const entry of entries) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkAll(p));
    else if (entry.isFile()) out.push(p);
  }
  return out;
}

/**
 * Strip fenced code blocks whose language tag is text/console/bash from the body
 * before scanning. Markdown blockquote lines (starting with '>') are skipped.
 * Inline backtick spans are blanked out so example paths shown as `code` don't
 * trip the host-path regex.
 */
function bodyScanLines(body) {
  const lines = body.split("\n");
  const out = [];
  let inFence = false;
  let skipFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fenceMatch = line.match(/^```(\S*)/);
    if (fenceMatch) {
      if (!inFence) {
        inFence = true;
        const lang = (fenceMatch[1] ?? "").toLowerCase();
        skipFence = lang === "text" || lang === "console" || lang === "bash";
      } else {
        inFence = false;
        skipFence = false;
      }
      continue;
    }
    if (inFence && skipFence) continue;
    if (line.trimStart().startsWith(">")) continue;
    // Blank out inline backtick spans so example paths in docs don't trip.
    const scrubbed = line.replace(/`[^`]*`/g, "");
    out.push({ line: scrubbed, idx: i, raw: line });
  }
  return out;
}

export function auditPathLeak(registry) {
  const findings = [];
  for (const [, node] of registry.nodes) {
    if (!node.dir) continue;
    // Body scan: strip carve-out blocks.
    const body = node.body ?? "";
    if (body) {
      for (const { line, idx, raw } of bodyScanLines(body)) {
        if (HOST_PATH_RE.test(line)) {
          findings.push({
            severity: "MEDIUM",
            code: "A030_HOST_PATH_LEAK",
            where: `${node.dir}/SKILL.md:body+${idx + 1}`,
            message: `host-path literal in body: ${(raw ?? line).trim()}`,
          });
        }
      }
    }
    // Scripts scan: all text files under scripts/.
    const scriptsDir = join(node.dir, "scripts");
    try {
      if (!statSync(scriptsDir).isDirectory()) continue;
    } catch {
      continue;
    }
    for (const file of walkAll(scriptsDir)) {
      // Only scan text-ish files: extension list is best-effort.
      const ext = extname(file);
      const TEXT_EXT = new Set([
        ".sh",
        ".bash",
        ".py",
        ".mjs",
        ".js",
        ".ts",
        ".md",
        ".yaml",
        ".yml",
        ".json",
        ".toml",
        ".txt",
        "",
      ]);
      if (!TEXT_EXT.has(ext)) continue;
      let text;
      try {
        text = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      const lines = text.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (HOST_PATH_RE.test(lines[i])) {
          findings.push({
            severity: "MEDIUM",
            code: "A030_HOST_PATH_LEAK",
            where: `${file}:${i + 1}`,
            message: `host-path literal: ${lines[i].trim()}`,
          });
        }
      }
    }
  }
  return findings;
}
