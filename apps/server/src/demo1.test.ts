import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { dataOf } from "@orbivit/core";
import { scenarioPaths } from "./app.ts";
import { ReplaySession } from "./session.ts";

const runs = mkdtempSync(join(tmpdir(), "orbivit-demo1-"));

async function play(session: ReplaySession, untilDay: number): Promise<void> {
  for (let guard = 0; guard < 2000 && session.day < untilDay; guard++) {
    if (session.waiting) await session.autoStep();
    else await session.advance(Math.min(1, untilDay - session.day));
  }
}

/** Demo 1 with a changed scenario file (for example without the heart-rate drift). */
function variant(change: (yaml: string) => string): ReplaySession {
  const paths = scenarioPaths("demo1-ijv-thrombosis", runs);
  const file = join(runs, `variant-${Math.random().toString(36).slice(2)}.yaml`);
  writeFileSync(file, change(readFileSync(paths.scenario, "utf8")));
  return new ReplaySession({ ...paths, scenario: file });
}

describe("Demo 1 replay with the no-LLM fallback", async () => {
  const session = new ReplaySession(scenarioPaths("demo1-ijv-thrombosis", runs));
  await play(session, 75);
  const view = session.view();
  const event = view.events[0]!;
  const trigger = event.log[0]!;

  it("opens one surveillance event, brought forward by the sleeping heart-rate watch", () => {
    expect(view.events).toHaveLength(1);
    expect(event.trigger).toBe("surveillance");
    expect(event.openedAt).toBeGreaterThan(40);
    expect(event.openedAt).toBeLessThan(47);
    expect(dataOf(trigger, "trigger")?.findings).toEqual([
      "f-prior-ijv-flow-abnormal",
      "f-sleeping-hr-up",
    ]);
    expect(dataOf(trigger, "trigger")?.surveillance).toMatchObject({ dueDay: 60, early: true });
    expect(view.markers.some((m) => m.kind === "surveillance")).toBe(true);
  });

  it("asks the red-flag questions first and runs the ultrasound before the action", () => {
    const steps = event.log
      .filter((l) => ["question", "test", "action"].includes(l.stepType))
      .map((l) => l.stepId);
    expect(steps.slice(0, 4).sort()).toEqual(
      ["q-chest-pain", "q-dyspnea", "q-headache-vision", "q-syncope"].sort(),
    );
    expect(steps.indexOf("t-ultrasound-ijv")).toBeGreaterThan(0);
    expect(steps.indexOf("t-ultrasound-ijv")).toBeLessThan(steps.indexOf("a-escalate-vte"));
  });

  it("ranks IJV thrombosis first and escalates when the action is approved", () => {
    expect(event.diagnoses[0]?.name).toMatch(/jugular/);
    expect(event.outcome).toBe("escalated");
    const last = event.log.at(-1)!;
    expect(last.stepType).toBe("escalate");
    expect(dataOf(last, "escalate")?.action).toBe("a-escalate-vte");
  });

  it("shows Maya's real labs, the record and the scan images", () => {
    expect(view.astronaut.composite).toBeDefined();
    const albumin = view.record.labs.find((l) => l.measure === "albumin");
    expect(albumin).toMatchObject({ value: 4.2, unit: "g/dL", label: "REAL" });
    expect(view.record.entries.map((e) => e.id)).toEqual(["rec-preflight-us", "rec-inflight-us"]);
    expect(view.record.entries[0]?.image?.url).toBe("/api/reference/fig3b.jpg");
    expect(view.testImages["t-ultrasound-ijv"]?.url).toBe("/api/reference/fig3c.jpg");
    expect(view.charts).toEqual(["sleepingHr", "restingHr"]);
  });
});

describe("Demo 1 branches", () => {
  it("opens the scheduled reassessment on its due day when the heart rate does not change", async () => {
    const session = variant((y) =>
      y.replace(/\ndrifts:[\s\S]*?\nspikes:/, "\ndrifts: []\nspikes:"),
    );
    await play(session, 65);
    const event = session.view().events[0]!;
    expect(event.trigger).toBe("surveillance");
    expect(event.openedAt).toBe(60);
    expect(dataOf(event.log[0], "trigger")?.findings).toEqual(["f-prior-ijv-flow-abnormal"]);
  });

  it("escalates at once when the astronaut reports new shortness of breath", async () => {
    const session = new ReplaySession(scenarioPaths("demo1-ijv-thrombosis", runs));
    session.override("q-dyspnea", "yes");
    await play(session, 50);
    const event = session.view().events[0]!;
    expect(event.outcome).toBe("escalated");
    expect(dataOf(event.log.at(-1), "escalate")?.reason).toMatch(/red flag/);
  });

  it("records a structured finding entered by the operator", async () => {
    const session = new ReplaySession(scenarioPaths("demo1-ijv-thrombosis", runs));
    for (let guard = 0; guard < 500; guard++) {
      const e = session.view().events[0];
      if (e?.pending?.kind === "test" && e.pending.id === "t-ultrasound-ijv") break;
      if (session.waiting) await session.autoStep();
      else await session.advance(1);
    }
    await session.runTest("evt-001", "t-ultrasound-ijv", {
      "ijv-flow-detected": true,
      "ijv-flow-grade": 2,
      "ijv-compressible": true,
      "ijv-thrombus": false,
    });
    const result = session
      .view()
      .events[0]!.log.find((l) => l.stepType === "result" && l.stepId === "t-ultrasound-ijv");
    expect(result?.stepType === "result" && result.data.findings).toEqual(["f-ijv-no-thrombus"]);
    // The log stores coded values: measure IDs, and UCUM units for quantities.
    expect(result?.stepType === "result" && result.data.values).toContainEqual({
      measure: "ijv-flow-grade",
      value: 2,
      unit: "{grade}",
    });
  });

  it("rejects a test value for a measure the test does not return", async () => {
    const session = new ReplaySession(scenarioPaths("demo1-ijv-thrombosis", runs));
    for (let guard = 0; guard < 500; guard++) {
      const e = session.view().events[0];
      if (e?.pending?.kind === "test" && e.pending.id === "t-ultrasound-ijv") break;
      if (session.waiting) await session.autoStep();
      else await session.advance(1);
    }
    await expect(
      session.runTest("evt-001", "t-ultrasound-ijv", { thrombus: true }),
    ).rejects.toThrow(/does not return thrombus/);
    await expect(
      session.runTest("evt-001", "t-ultrasound-ijv", { "ijv-thrombus": "yes" }),
    ).rejects.toThrow(/must be a boolean/);
  });
});
