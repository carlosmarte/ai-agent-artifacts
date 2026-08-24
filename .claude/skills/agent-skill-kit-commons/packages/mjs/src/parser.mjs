import { parse as parseYaml } from "yaml";

export class MissingFrontmatterError extends Error {
  constructor(message) {
    super(message);
    this.name = "MissingFrontmatterError";
  }
}

export class MalformedFrontmatterError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "MalformedFrontmatterError";
    this.cause = cause;
  }
}

const DEP_RE =
  /^(?:(?<owner>[A-Za-z0-9_.-]+)\/(?<repo>[A-Za-z0-9_.-]+)#)?(?<name>[a-z0-9-]+)(?:@(?<range>.+))?$/;

function normalizeDep(entry) {
  if (entry == null) return null;
  if (typeof entry === "string") {
    const m = DEP_RE.exec(entry.trim());
    if (!m) {
      return {
        name: entry.trim(),
        version_range: null,
        origin: "in_repo",
        owner: null,
        repo: null,
      };
    }
    const { owner, repo, name, range } = m.groups;
    return {
      name,
      version_range: range ?? null,
      origin: owner ? "cross_repo" : "in_repo",
      owner: owner ?? null,
      repo: repo ?? null,
    };
  }
  if (typeof entry === "object" && entry.name) {
    const ref =
      entry.ref ??
      (entry.owner && entry.repo
        ? `${entry.owner}/${entry.repo}#${entry.name}`
        : entry.name);
    const normalized = normalizeDep(
      entry.version_range ? `${ref}@${entry.version_range}` : ref,
    );
    return normalized;
  }
  return null;
}

function normalizeAllowedTools(v) {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") {
    return v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeMetadata(v) {
  if (v == null || typeof v !== "object") return {};
  const out = {};
  for (const [k, val] of Object.entries(v)) {
    out[String(k)] = val == null ? "" : String(val);
  }
  return out;
}

export function parseFrontmatter(text) {
  if (typeof text !== "string") {
    throw new MissingFrontmatterError("input is not a string");
  }
  // Allow optional BOM and leading whitespace before the opening delimiter.
  const stripped = text.replace(/^﻿/, "");
  const lines = stripped.split("\n");
  if (lines.length === 0 || lines[0].trim() !== "---") {
    throw new MissingFrontmatterError(
      "frontmatter must begin with '---' on the first line",
    );
  }
  let closeIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      closeIdx = i;
      break;
    }
  }
  if (closeIdx === -1) {
    throw new MissingFrontmatterError(
      "frontmatter has no closing '---' delimiter",
    );
  }
  const yamlBlock = lines.slice(1, closeIdx).join("\n");
  let data;
  try {
    data = parseYaml(yamlBlock) ?? {};
  } catch (e) {
    throw new MalformedFrontmatterError(
      `frontmatter YAML is malformed: ${e.message}`,
      e,
    );
  }
  if (typeof data !== "object" || Array.isArray(data)) {
    throw new MalformedFrontmatterError(
      "frontmatter YAML must be a mapping",
    );
  }
  const body = lines.slice(closeIdx + 1).join("\n");
  const source_offset =
    lines.slice(0, closeIdx + 1).join("\n").length + 1; // newline after closing ---
  const deps = Array.isArray(data.dependencies)
    ? data.dependencies.map(normalizeDep).filter(Boolean)
    : [];
  return {
    name: data.name != null ? String(data.name) : null,
    description: data.description != null ? String(data.description) : null,
    tier: data.tier != null ? String(data.tier) : null,
    license: data.license != null ? String(data.license) : null,
    compatibility:
      data.compatibility != null ? String(data.compatibility) : null,
    metadata: normalizeMetadata(data.metadata),
    allowed_tools: normalizeAllowedTools(data["allowed-tools"] ?? data.allowed_tools),
    dependencies: deps,
    body,
    source_offset,
    raw_frontmatter: data,
  };
}

export function toCanonicalJson(parsed) {
  return JSON.stringify(sortKeys(parsed));
}

function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortKeys(v[k]);
    return out;
  }
  return v;
}
