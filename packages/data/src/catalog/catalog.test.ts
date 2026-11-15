import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadCatalog, validateCatalog } from "../index.ts";

const catalog = loadCatalog(fileURLToPath(new URL("../../../../catalog", import.meta.url)));

describe("condition catalog", () => {
  it("has 10–15 conditions (ADR 0010)", () => {
    expect(catalog.conditions.length).toBeGreaterThanOrEqual(10);
    expect(catalog.conditions.length).toBeLessThanOrEqual(15);
  });

  it("includes the conditions both demos need", () => {
    const ids = catalog.conditions.map((c) => c.id);
    for (const id of [
      "cv-deconditioning",
      "ijv-thrombosis",
      "reduced-fluid-volume",
      "infection",
      "arrhythmia",
    ]) {
      expect(ids).toContain(id);
    }
  });

  it("is internally consistent", () => {
    expect(validateCatalog(catalog)).toEqual([]);
  });

  it("reports an unknown finding", () => {
    const broken = structuredClone(catalog);
    broken.conditions[0]!.supports.push("f-does-not-exist");
    expect(validateCatalog(broken).join()).toContain("f-does-not-exist");
  });

  it("marks the cartridge test as consumable", () => {
    expect(catalog.tests.find((t) => t.id === "t-istat-chem8")?.consumable).toBe(true);
  });
});
