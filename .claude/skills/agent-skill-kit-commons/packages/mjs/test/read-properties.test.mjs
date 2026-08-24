import { describe, it, expect } from "vitest";
import { resolve, join } from "node:path";
import {
  readProperties,
  readPropertiesRoot,
  PROPERTY_FIELDS,
} from "../src/prompt/read_properties.mjs";

const REGISTRY = resolve(
  new URL("../../../fixtures/prompt/registry", import.meta.url).pathname,
);

describe("readProperties (single)", () => {
  it("returns _path + all 8 spec fields", () => {
    const out = readProperties(join(REGISTRY, "prompt-fix-a"));
    expect(out._path).toMatch(/prompt-fix-a\/SKILL\.md$/);
    for (const f of PROPERTY_FIELDS) expect(out).toHaveProperty(f);
    expect(out.name).toBe("prompt-fix-a");
    expect(out.tier).toBe("org");
    expect(out.license).toBeNull();
    expect(out.compatibility).toBeNull();
  });

  it("emits dependencies as plain objects (not class instances)", () => {
    const out = readProperties(join(REGISTRY, "prompt-fix-b"));
    expect(Array.isArray(out.dependencies)).toBe(true);
    expect(out.dependencies[0]).toEqual({
      name: "prompt-fix-a",
      origin: "in_repo",
      owner: null,
      repo: null,
      version_range: null,
    });
  });

  it("resolves _path to absolute (host-prefix present)", () => {
    const out = readProperties(join(REGISTRY, "prompt-fix-a"));
    expect(out._path.startsWith("/")).toBe(true);
  });
});

describe("readPropertiesRoot", () => {
  it("returns an array of objects ordered by name", () => {
    const arr = readPropertiesRoot(REGISTRY);
    expect(arr.length).toBe(5);
    const names = arr.map((o) => o.name);
    expect(names).toEqual([
      "prompt-fix-a",
      "prompt-fix-b",
      "prompt-fix-c",
      "prompt-fix-d",
      "prompt-fix-e",
    ]);
  });

  it("each entry has _path + 8 fields", () => {
    const arr = readPropertiesRoot(REGISTRY);
    for (const o of arr) {
      expect(o).toHaveProperty("_path");
      for (const f of PROPERTY_FIELDS) expect(o).toHaveProperty(f);
    }
  });
});
