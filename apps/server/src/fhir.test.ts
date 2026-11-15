import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CODE_SYSTEMS } from "@orbivit/core";
import { buildApp, scenarioPaths } from "./app.ts";
import { toFhirBundle } from "./fhir.ts";
import { ReplaySession } from "./session.ts";

const runs = mkdtempSync(join(tmpdir(), "orbivit-fhir-"));

type Entry = { fullUrl: string; resource: Record<string, unknown> & { resourceType: string } };
type Coding = { system: string; code: string; display?: string };

async function play(session: ReplaySession, untilDay: number): Promise<void> {
  for (let guard = 0; guard < 2000 && session.day < untilDay; guard++) {
    if (session.waiting) await session.autoStep();
    else await session.advance(Math.min(1, untilDay - session.day));
  }
}

describe("FHIR R4 export of Demo 1 (no-LLM fallback)", async () => {
  const session = new ReplaySession(scenarioPaths("demo1-ijv-thrombosis", runs));
  await play(session, 75);
  const bundle = toFhirBundle(session.view(), new Date("2026-11-15T00:00:00Z")) as unknown as {
    resourceType: string;
    type: string;
    entry: Entry[];
  };
  const of = (type: string) =>
    bundle.entry.filter((e) => e.resource.resourceType === type).map((e) => e.resource);
  const observations = of("Observation") as unknown as {
    id: string;
    status: string;
    code: { coding: Coding[] };
    valueQuantity?: { value: number; system?: string; code?: string };
    referenceRange?: { type?: { coding: Coding[] } }[];
    meta: { tag: Coding[] };
    effectiveDateTime?: string;
  }[];

  it("is a collection bundle with unique ids and urn:uuid full URLs", () => {
    expect(bundle.resourceType).toBe("Bundle");
    expect(bundle.type).toBe("collection");
    const urls = bundle.entry.map((e) => e.fullUrl);
    expect(new Set(urls).size).toBe(urls.length);
    for (const u of urls) expect(u).toMatch(/^urn:uuid:[0-9a-f-]{36}$/);
    for (const e of bundle.entry) expect(String(e.resource.id)).toMatch(/^[A-Za-z0-9\-.]{1,64}$/);
  });

  it("tags the composite astronaut", () => {
    const patient = of("Patient")[0] as unknown as { meta: { tag: Coding[] } };
    expect(patient.meta.tag).toContainEqual({
      system: "urn:orbivit:data-label",
      code: "COMPOSITE",
    });
  });

  it("codes every observation, with UCUM units on every quantity", () => {
    expect(observations.length).toBeGreaterThan(50);
    const units = new Set(session.catalog.units.map((u) => u.code));
    for (const o of observations) {
      const first = o.code.coding[0]!;
      expect([CODE_SYSTEMS.measure, CODE_SYSTEMS.finding]).toContain(first.system);
      if (o.valueQuantity) {
        expect(o.valueQuantity.system).toBe(CODE_SYSTEMS.ucum);
        expect(units.has(o.valueQuantity.code ?? "")).toBe(true);
      }
      expect(o.meta.tag[0]?.system).toBe("urn:orbivit:data-label");
      expect(o.effectiveDateTime).toMatch(/^\d{4}-\d\d-\d\dT/);
    }
  });

  it("exports Maya's real albumin with its LOINC code and the lab reference range", () => {
    const albumin = observations.find((o) => o.code.coding.some((c) => c.code === "1751-7"))!;
    expect(albumin.meta.tag).toContainEqual({ system: "urn:orbivit:data-label", code: "REAL" });
    expect(albumin.valueQuantity).toMatchObject({ system: CODE_SYSTEMS.ucum, code: "g/dL" });
    expect(albumin.referenceRange?.[0]?.type?.coding[0]?.code).toBe("normal");
  });

  it("keeps the operator's structured ultrasound finding preliminary", () => {
    const grade = observations.filter((o) => o.code.coding[0]?.code === "ijv-thrombus");
    expect(grade.length).toBeGreaterThan(0);
    for (const o of grade) expect(o.status).toBe("preliminary");
  });

  it("never confirms a diagnosis; the unranked fallback list is differential, with clinical codes", () => {
    const conditions = of("Condition") as unknown as {
      verificationStatus: { coding: Coding[] };
      code: { coding: Coding[] };
    }[];
    expect(conditions.length).toBeGreaterThan(0);
    for (const c of conditions)
      expect(["differential", "provisional"]).toContain(c.verificationStatus.coding[0]?.code);
    const ijv = conditions.find((c) => c.code.coding[0]?.code === "ijv-thrombosis")!;
    // The no-LLM fallback does not rank, so no diagnosis is provisional (docs/technical/10 rule 8).
    expect(ijv.verificationStatus.coding[0]?.code).toBe("differential");
    // A wider SNOMED CT code is in the concept; the narrower ICD-10-CM code is only in a ConceptMap.
    expect(ijv.code.coding.find((c) => c.system === CODE_SYSTEMS.snomed)?.code).toBe("128053003");
    expect(ijv.code.coding.some((c) => c.system === CODE_SYSTEMS.icd10cm)).toBe(false);
    // The unranked fallback has no confidence to report.
    expect(of("RiskAssessment")).toEqual([]);
  });

  it("uses no custom extensions", () => {
    expect(JSON.stringify(bundle)).not.toContain('"extension"');
  });

  it("states every mapping and its equivalence in ConceptMaps", () => {
    const maps = of("ConceptMap") as unknown as {
      group: {
        source: string;
        target: string;
        element: { code: string; target: { code?: string; equivalence: string }[] }[];
      }[];
    }[];
    const target = (source: string, system: string, code: string) =>
      maps
        .flatMap((m) => m.group)
        .find((g) => g.source === source && g.target === system)
        ?.element.find((e) => e.code === code)?.target;
    expect(target(CODE_SYSTEMS.condition, CODE_SYSTEMS.snomed, "ijv-thrombosis")).toEqual([
      expect.objectContaining({ code: "128053003", equivalence: "wider" }),
    ]);
    expect(target(CODE_SYSTEMS.condition, CODE_SYSTEMS.icd10cm, "ijv-thrombosis")).toEqual([
      expect.objectContaining({ code: "I82.C1", equivalence: "narrower" }),
    ]);
    expect(target(CODE_SYSTEMS.measure, CODE_SYSTEMS.loinc, "activity-index")?.[0]).toMatchObject({
      equivalence: "unmatched",
    });
  });

  it("places the run on the mission Encounter, from the mission epoch", () => {
    const encounter = of("Encounter")[0] as unknown as { period: { start: string } };
    expect(encounter.period.start).toBe("2035-01-01T00:00:00Z");
    const lab = observations.find((o) => o.code.coding.some((c) => c.code === "1751-7"))!;
    expect(lab.effectiveDateTime!.startsWith("2034-12-")).toBe(true);
  });

  it("exports blood pressure as one vital-signs panel with systolic and diastolic components", () => {
    const panels = observations.filter((o) => o.code.coding.some((c) => c.code === "85354-9"));
    expect(panels.length).toBeGreaterThan(0);
    const panel = panels[0] as unknown as { component: { code: { coding: Coding[] } }[] };
    expect(panel.component.map((c) => c.code.coding.map((x) => x.code))).toEqual([
      expect.arrayContaining(["8480-6"]),
      expect.arrayContaining(["8462-4"]),
    ]);
    expect(observations.some((o) => o.code.coding[0]?.code === "systolic-bp")).toBe(false);
  });

  it("records the escalation and the approved action", () => {
    expect(of("Communication").length).toBeGreaterThan(0);
    expect(of("Task").some((t) => t.status === "accepted")).toBe(true);
    expect(of("QuestionnaireResponse").length).toBe(1);
  });

  it("codes every requested test with its equipment-list ID", () => {
    const testIds = new Set(session.catalog.tests.map((t) => t.id));
    const tests = (of("Task") as unknown as { code?: { coding: Coding[] } }[]).filter(
      (t) => t.code,
    );
    expect(tests.length).toBeGreaterThan(0);
    for (const t of tests) {
      const coding = t.code!.coding.find((c) => c.system === CODE_SYSTEMS.test);
      expect(testIds.has(coding?.code ?? "")).toBe(true);
    }
  });

  it("serves the bundle at /api/fhir/export", async () => {
    const app = buildApp({ runsDir: runs });
    const response = await app.inject({ method: "GET", url: "/api/fhir/export" });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("application/fhir+json");
    expect((JSON.parse(response.body) as { resourceType: string }).resourceType).toBe("Bundle");
    await app.close();
  });
});
