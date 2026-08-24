import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PREFIXES_PATH = resolve(__dirname, "..", "..", "assets", "vendor_prefixes.txt");

let _prefixes = null;
function loadPrefixes() {
  if (_prefixes) return _prefixes;
  _prefixes = readFileSync(PREFIXES_PATH, "utf8")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  return _prefixes;
}

const ALLOWED_TOP_LEVEL = new Set([
  "name",
  "description",
  "tier",
  "license",
  "compatibility",
  "metadata",
  "allowed-tools",
  "dependencies",
]);

export function checkVendorNeutrality(parsed) {
  const issues = [];
  const ps = loadPrefixes();
  const fm = parsed?.raw_frontmatter ?? {};
  for (const key of Object.keys(fm)) {
    if (ALLOWED_TOP_LEVEL.has(key)) continue;
    if (ps.some((p) => key.startsWith(p))) {
      issues.push({
        code: "L001_VENDOR_SPECIFIC_FIELD",
        severity: "warn",
        field: key,
        message: `'${key}' is vendor-specific; move under 'metadata' to preserve portability across agents`,
      });
    }
  }
  return issues;
}
