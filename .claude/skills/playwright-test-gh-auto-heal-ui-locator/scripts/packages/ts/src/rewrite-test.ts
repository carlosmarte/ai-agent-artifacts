import { readFile, writeFile, copyFile } from "node:fs/promises";
import { Project, SyntaxKind, type CallExpression } from "ts-morph";
import type { FailingLocator } from "./types.js";

export interface RewriteOptions {
  /** Write a .bak copy of the file before rewriting. Default true. */
  backup?: boolean;
  /** Dry run: produce diff but do not write. Default false. */
  dryRun?: boolean;
}

export interface RewriteResult {
  changed: boolean;
  diff: string;
  backupPath?: string;
}

/**
 * Replace one failing locator call with the candidate locator expression.
 *
 * @param testFile  absolute path to the .spec.ts file
 * @param failing   the failure record (api + rawSelector + line)
 * @param newCall   the replacement expression body, e.g.
 *                  `getByRole('button', { name: 'Place order' })`
 */
export async function rewriteTest(
  testFile: string,
  failing: FailingLocator,
  newCall: string,
  opts: RewriteOptions = {},
): Promise<RewriteResult> {
  const { backup = true, dryRun = false } = opts;
  const original = await readFile(testFile, "utf8");

  let updated: string;
  try {
    updated = rewriteWithAst(testFile, original, failing, newCall);
  } catch {
    updated = rewriteWithRegex(original, failing, newCall);
  }

  if (updated === original) {
    return { changed: false, diff: "" };
  }

  const diff = unifiedDiff(testFile, original, updated);

  if (dryRun) {
    return { changed: true, diff };
  }

  let backupPath: string | undefined;
  if (backup) {
    backupPath = `${testFile}.bak`;
    await copyFile(testFile, backupPath);
  }
  await writeFile(testFile, updated, "utf8");
  return { changed: true, diff, backupPath };
}

function rewriteWithAst(
  filePath: string,
  source: string,
  failing: FailingLocator,
  newCall: string,
): string {
  const project = new Project({ useInMemoryFileSystem: false });
  const sf = project.createSourceFile(filePath, source, { overwrite: true });

  let replaced = false;
  sf.forEachDescendant((node) => {
    if (replaced) return;
    if (node.getKind() !== SyntaxKind.CallExpression) return;
    const call = node as CallExpression;
    const expr = call.getExpression().getText();
    if (!expr.endsWith(`.${failing.api}`)) return;
    const args = call.getArguments();
    if (args.length === 0) return;
    const first = args[0].getText().replace(/^['"`]|['"`]$/g, "");
    if (first !== failing.rawSelector) return;

    // Replace the entire `xxx.api(args)` with `xxx.newCall`.
    const receiver = expr.replace(new RegExp(`\\.${failing.api}$`), "");
    call.replaceWithText(`${receiver}.${newCall}`);
    replaced = true;
  });

  return replaced ? sf.getFullText() : source;
}

function rewriteWithRegex(
  source: string,
  failing: FailingLocator,
  newCall: string,
): string {
  const escSel = failing.rawSelector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rx = new RegExp(
    `\\.${failing.api}\\(\\s*(['"\`])${escSel}\\1\\s*\\)`,
    "g",
  );
  return source.replace(rx, `.${newCall}`);
}

function unifiedDiff(path: string, oldText: string, newText: string): string {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const out: string[] = [];
  out.push(`--- a/${path}`);
  out.push(`+++ b/${path}`);
  const max = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < max; i++) {
    if (oldLines[i] !== newLines[i]) {
      if (oldLines[i] !== undefined) out.push(`-${oldLines[i]}`);
      if (newLines[i] !== undefined) out.push(`+${newLines[i]}`);
    }
  }
  return out.join("\n");
}
