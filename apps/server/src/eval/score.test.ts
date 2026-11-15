import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scenarioPaths } from "../app.ts";
import { toFhirBundle } from "../fhir.ts";
import { ReplaySession } from "../session.ts";
import { CASES } from "./cases.ts";
import { median, modelShare, pathwaySafety, percentile, readBundle, type Bundle } from "./score.ts";

const runs = mkdtempSync(join(tmpdir(), "orbivit-eval-"));

async function fallbackRun(
  scenario: string,
  untilDay: number,
  overrides: Record<string, string> = {},
) {
  const s = new ReplaySession(scenarioPaths(scenario, runs));
  for (const [q, t] of Object.entries(overrides)) s.override(q, t);
  for (let guard = 0; guard < 2000 && s.day < untilDay; guard++) {
    if (s.waiting) await s.autoStep();
    else await s.advance(Math.min(1, untilDay - s.day));
  }
  return { run: readBundle(toFhirBundle(s.view()) as unknown as Bundle), catalog: s.catalog };
}

const main = CASES.find((c) => c.id === "main-base")!;

describe("M2 scoring from the FHIR Bundle (main demo, no-LLM fallback)", async () => {
  const { run, catalog } = await fallbackRun("demo2-deconditioning", 150);

  it("reads the record: coded tests, the pathway action, and fallback provenance", () => {
    expect(run.tests.map((t) => t.testId)).toContain("t-std-exercise-test");
    expect(run.actions).toEqual([
      expect.objectContaining({
        conditionId: "cv-deconditioning",
        actionId: "a-countermeasure-review",
        status: "accepted",
      }),
    ]);
    expect(run.agents.every((a) => a.startsWith("rule-based fallback"))).toBe(true);
    expect(modelShare(run, "ollama medgemma:27b")).toEqual({ model: 0, total: run.agents.length });
  });

  it("passes pathway safety", () => {
    expect(pathwaySafety(run, catalog).pass).toBe(true);
  });

  it("fails the unranked fallback only on the provisional diagnosis", () => {
    const failed = main.expect(run).filter((c) => !c.pass);
    expect(failed.map((c) => c.id)).toEqual(["provisional cv-deconditioning"]);
  });

  it("passes a ranked run with the same steps", () => {
    const ranked = {
      ...run,
      conditions: run.conditions.map((c) =>
        c.conditionId === "cv-deconditioning" ? { ...c, verification: "provisional" } : c,
      ),
    };
    expect(main.expect(ranked).every((c) => c.pass)).toBe(true);
  });

  it("fails when a confirming test comes after the action", () => {
    const late = {
      ...run,
      tests: run.tests.map((t) => (t.testId === "t-ecg" ? { ...t, id: "evt-001-999" } : t)),
    };
    const check = main.expect(late).find((c) => c.id.startsWith("before action"))!;
    expect(check.pass).toBe(false);
    expect(check.detail).toContain("t-ecg");
  });

  it("flags an action outside the approved pathway and a confirmed diagnosis", () => {
    const unsafe = {
      ...run,
      actions: [
        {
          id: "evt-001-050",
          conditionId: "cv-deconditioning",
          actionId: "a-infection-care",
          status: "accepted",
        },
      ],
      conditions: [
        {
          id: "evt-001-cv",
          conditionId: "cv-deconditioning",
          verification: "confirmed",
          clinical: "active",
        },
      ],
    };
    const safety = pathwaySafety(unsafe, catalog);
    expect(safety.pass).toBe(false);
    expect(safety.detail).toContain("a-infection-care");
    expect(safety.detail).toContain("confirmed");
  });
});

describe("M2 branch cases with the no-LLM fallback", () => {
  it("escalates the chest-pain branch without an action", async () => {
    const c = CASES.find((x) => x.id === "main-chest-pain")!;
    const { run } = await fallbackRun(c.scenario, c.untilDay, c.overrides);
    expect(c.expect(run).every((x) => x.pass)).toBe(true);
  });

  it("fails the fever branch: the fixed fallback order never asks about fever", async () => {
    const c = CASES.find((x) => x.id === "main-fever")!;
    const { run } = await fallbackRun(c.scenario, c.untilDay, c.overrides);
    expect(c.expect(run).find((x) => x.id === "asked q-fever")?.pass).toBe(false);
  });
});

describe("latency statistics", () => {
  it("computes the median and p90", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90)).toBe(9);
  });
});
