import {
  readFileSync,
  writeFileSync,
  copyFileSync,
  unlinkSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";

/**
 * Locate the `description:` line within the YAML frontmatter (the block
 * between the first two `---` lines). Returns -1 if not found.
 */
export function findDescriptionLine(lines) {
  let seenOpen = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      if (!seenOpen) {
        seenOpen = true;
        continue;
      }
      return -1; // hit close before finding description
    }
    if (seenOpen && /^description:\s/.test(lines[i])) {
      return i;
    }
  }
  return -1;
}

export function applyVariant(skillDir, variant) {
  const path = join(skillDir, "SKILL.md");
  const original = readFileSync(path, "utf8");
  const lines = original.split("\n");
  const idx = findDescriptionLine(lines);
  if (idx === -1) {
    throw new Error("description: line not found in frontmatter");
  }
  lines[idx] = `description: ${variant.text}`;
  const rewritten = lines.join("\n");
  const bak = path + ".bak";
  copyFileSync(path, bak);
  writeFileSync(path, rewritten, "utf8");
  return { applied: true, backup: bak, originalLine: original.split("\n")[idx] };
}

export function commit(backup) {
  if (backup && existsSync(backup)) unlinkSync(backup);
}

export function rollback(skillDir, backup) {
  const path = join(skillDir, "SKILL.md");
  if (backup && existsSync(backup)) {
    copyFileSync(backup, path);
    unlinkSync(backup);
    return true;
  }
  return false;
}
