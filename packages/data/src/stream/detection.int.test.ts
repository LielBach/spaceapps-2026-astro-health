import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_DETECTION, Detector, type DetectionOutput } from "@astrohealth/core";
import { createStream, loadAnchors, loadScenario } from "../index.ts";

const repo = (path: string) => fileURLToPath(new URL(`../../../../${path}`, import.meta.url));
const scenario = loadScenario(repo("scenarios/demo2-deconditioning.yaml"));
const stream = createStream(
  scenario,
  loadAnchors(repo("data/anchors"), scenario.astronaut.anchorSources),
);

function run(from: number, to: number): DetectionOutput[] {
  const detector = new Detector({ ...DEFAULT_DETECTION, baselineDays: [60, 90] });
  const out: DetectionOutput[] = [];
  for (let day = from; day < to; day++)
    out.push(...detector.ingest(stream.samplesBetween(day, day + 1)));
  return out;
}

describe("Demo 2 detection", () => {
  const out = run(60, 130);
  const open = out.filter((o) => o.kind === "open");

  it("freezes the baseline at the end of the baseline window", () => {
    const frozen = out.find((o) => o.kind === "baselineFrozen");
    expect(frozen?.t).toBe(90);
  });

  it("ignores the two benign spikes with the right filter", () => {
    const ignored = out.filter((o) => o.kind === "ignored");
    expect(
      ignored.some((o) => o.t >= 95.5 && o.t < 95.6 && o.reason.includes("unscheduled exercise")),
    ).toBe(true);
    expect(
      ignored.some((o) => o.t >= 97.6 && o.t < 97.7 && o.reason.includes("single spike")),
    ).toBe(true);
  });

  it("opens exactly one event, after the drift starts, from two exercise signals", () => {
    expect(open).toHaveLength(1);
    const event = open[0]!;
    expect(event.t).toBeGreaterThan(100);
    expect(event.t).toBeLessThan(120);
    expect(event.kind === "open" && event.findings).toEqual(
      expect.arrayContaining(["f-exercise-hr-up", "f-max-workload-down"]),
    );
    expect(event.kind === "open" && event.context).toContain("f-resting-hr-in-band");
  });

  it("raises no urgent interrupt", () => {
    expect(out.filter((o) => o.kind === "urgent")).toHaveLength(0);
  });

  it("never opens an event before the drift", () => {
    expect(out.some((o) => o.kind === "watch" && o.t < 100)).toBe(false);
  });
});
