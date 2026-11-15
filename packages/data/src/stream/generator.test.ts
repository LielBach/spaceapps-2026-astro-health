import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  createStream,
  loadAnchors,
  loadScenario,
  loadTerminology,
  normalizeAnchors,
} from "../index.ts";

const repo = (path: string) => fileURLToPath(new URL(`../../../../${path}`, import.meta.url));
const scenario = loadScenario(repo("scenarios/demo2-deconditioning.yaml"));
const anchors = normalizeAnchors(
  loadAnchors(repo("data/anchors"), scenario.astronaut.anchorSources),
  loadTerminology(repo("catalog")),
);
const stream = createStream(scenario, anchors);

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const standardHr = (
  from: number,
  to: number,
  interventions = [] as { action: string; day: number }[],
) =>
  stream
    .samplesBetween(from, to, interventions)
    .filter((s) => s.signal === "exerciseHr" && s.context === "exercise-standard")
    .map((s) => s.value);

describe("Demo 2 stream", () => {
  it("starts from Alex's real in-flight resting heart rate", () => {
    expect(stream.baseline("hr")).toBe(66);
  });

  it("is deterministic", () => {
    expect(stream.samplesBetween(100, 101)).toEqual(stream.samplesBetween(100, 101));
  });

  it("labels every sample SIMULATED", () => {
    expect(stream.samplesBetween(90, 92).every((s) => s.label === "SIMULATED")).toBe(true);
  });

  it("raises exercise HR at the standard workload by about 18 bpm", () => {
    const before = mean(standardHr(90, 100));
    const after = mean(standardHr(118, 125));
    expect(after - before).toBeGreaterThan(14);
    expect(after - before).toBeLessThan(22);
    expect(before).toBeGreaterThan(118);
    expect(before).toBeLessThan(132);
  });

  it("returns toward baseline after the countermeasure review", () => {
    const treated = mean(standardHr(136, 145, [{ action: "a-countermeasure-review", day: 120 }]));
    const untreated = mean(standardHr(136, 145));
    expect(untreated - treated).toBeGreaterThan(14);
  });

  it("contains the two benign spikes with their context", () => {
    const spikes = stream.samplesBetween(95, 98).filter((s) => s.signal === "hr" && s.value > 100);
    expect(spikes.some((s) => s.context === "exercise-free")).toBe(true);
    const rest = stream
      .samplesBetween(97.5, 97.7)
      .filter((s) => s.signal === "hr" && s.context === "rest");
    expect(Math.max(...rest.map((s) => s.value))).toBeGreaterThan(80);
  });

  it("keeps sleeping HR below resting HR", () => {
    const day = stream.samplesBetween(91, 92).filter((s) => s.signal === "hr");
    const sleep = mean(day.filter((s) => s.context === "sleep").map((s) => s.value));
    const rest = mean(day.filter((s) => s.context === "rest").map((s) => s.value));
    expect(sleep).toBeLessThan(rest);
  });
});
