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

describe("terminology registries (docs/technical/10)", () => {
  const problems = (change: (c: typeof catalog) => void) => {
    const broken = structuredClone(catalog);
    change(broken);
    return validateCatalog(broken).join("\n");
  };

  it("give every measure in use a UCUM unit on the allowlist", () => {
    expect(problems((c) => (c.measures.find((m) => m.id === "spo2")!.unit = "percent"))).toMatch(
      /measure spo2: unit percent is not on the UCUM allowlist/,
    );
  });

  it("reject a test that returns an unknown measure, or a rule on a measure it does not return", () => {
    const text = problems((c) => {
      const bp = c.tests.find((t) => t.id === "t-bp")!;
      bp.returns.push("blood-pressure-feeling");
      bp.rules[0]!.field = "sbp";
    });
    expect(text).toMatch(/t-bp: returns unknown measure blood-pressure-feeling/);
    expect(text).toMatch(/t-bp: rule field sbp is not returned/);
  });

  it("need a reason for an unmatched mapping and a code for a coded one", () => {
    const text = problems((c) => {
      c.findings.find((f) => f.id === "f-fever")!.mappings[0]!.code = undefined;
      c.findings.find((f) => f.id === "f-hrv-down")!.mappings[0]!.note = undefined;
    });
    expect(text).toMatch(
      /finding f-fever: the snomed mapping \(equivalent\) needs a code and a display/,
    );
    expect(text).toMatch(/finding f-hrv-down: an unmatched snomed mapping needs a note/);
  });

  it("list every finding in use, and no finding that is never used", () => {
    const text = problems((c) => {
      c.findings = c.findings.filter((f) => f.id !== "f-chest-pain");
      c.findings.push({ id: "f-unused", display: "Unused", mappings: [] });
    });
    expect(text).toMatch(/finding f-chest-pain: not in findings.yaml/);
    expect(text).toMatch(/finding f-unused: in findings.yaml but never used/);
  });

  it("give every condition a SNOMED CT and an ICD-10-CM mapping", () => {
    expect(problems((c) => (c.conditions[0]!.codes = c.conditions[0]!.codes.slice(0, 1)))).toMatch(
      /no icd10cm mapping/,
    );
  });

  it("give every stream signal and detection metric a measure", () => {
    expect(problems((c) => (c.measures = c.measures.filter((m) => m.signal !== "hrv")))).toMatch(
      /signal hrv: no measure/,
    );
  });
});
