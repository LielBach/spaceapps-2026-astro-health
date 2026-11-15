import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { z } from "zod";
import { PASSIVE_SIGNALS } from "@astrohealth/core";

const Signal = z.enum(PASSIVE_SIGNALS);

const Value = z.union([
  z.number(),
  z.object({ anchor: z.object({ measure: z.string(), condition: z.string() }) }),
]);

const Drift = z.object({
  signal: Signal,
  /** Applies only to samples with this context, when set. */
  context: z.string().optional(),
  fromDay: z.number(),
  toDay: z.number(),
  delta: z.number(),
  /** An action ID that reverses the drift, and how many days the return takes. */
  reversedBy: z.object({ action: z.string(), overDays: z.number().positive() }).optional(),
});

const Spike = z.object({
  signal: Signal,
  day: z.number(),
  hours: z.number().positive(),
  delta: z.number(),
  context: z.enum(["rest", "exercise-free"]),
  note: z.string(),
});

export const ScenarioSchema = z.object({
  id: z.string(),
  title: z.string(),
  seed: z.number().int(),
  astronaut: z.object({
    id: z.string(),
    displayName: z.string(),
    anchorSources: z.array(z.string()),
    composite: z.object({ sourceIds: z.array(z.string()), disclosure: z.string() }).optional(),
  }),
  mission: z.object({
    name: z.string(),
    lengthDays: z.number().positive(),
    replayFromDay: z.number(),
    commDelayMinutes: z.number().nonnegative(),
  }),
  stream: z.object({
    sampleEveryHours: z.number().positive(),
    sleepHours: z.tuple([z.number(), z.number()]),
    exercise: z.object({
      standardSessionHour: z.number(),
      standardWorkloadWatts: z.number(),
      maxTestEveryDays: z.number().int().positive(),
      maxTestBaselineWatts: z.number(),
    }),
    baselines: z.record(
      Signal,
      z.object({ value: Value, noiseSd: z.number(), sourceId: z.string() }),
    ),
    /** Sleeping HR = resting HR minus this. */
    sleepHrDrop: z.number(),
    /** Exercise HR at the standard workload, as a ratio to resting HR. */
    exerciseHrRatio: z.number(),
  }),
  drifts: z.array(Drift),
  spikes: z.array(Spike),
  /** Scripted answers, keyed by question ID. Unlisted questions get the default. */
  answers: z.object({ default: z.string(), byQuestion: z.record(z.string(), z.string()) }),
  /** Scripted results of active tests, keyed by test ID. */
  testResults: z.record(
    z.string(),
    z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])),
  ),
});

export type Scenario = z.infer<typeof ScenarioSchema>;

export function loadScenario(path: string): Scenario {
  return ScenarioSchema.parse(parse(readFileSync(path, "utf8")));
}
