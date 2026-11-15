import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { z } from "zod";
import { PASSIVE_SIGNALS, measureDef, resultProblems, type Catalog } from "@astrohealth/core";

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

const Label = z.enum(["REAL", "SIMULATED", "REFERENCE"]);

/** An image shown with its own credit (ADR 0009). Files live in data/reference/. */
const Media = z.object({
  file: z.string().regex(/^[a-z0-9-]+\.jpg$/),
  caption: z.string(),
  label: Label,
  sourceId: z.string(),
});

/** An entry of the imported medical record (Demo 1 step 1). */
const RecordEntry = z.object({
  id: z.string(),
  day: z.number(),
  kind: z.enum(["imaging", "note"]),
  title: z.string(),
  text: z.string(),
  label: Label,
  sourceId: z.string(),
  /** A finding for the investigation engine, for example a prior abnormal flow finding. */
  finding: z.string().optional(),
  image: Media.optional(),
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
    /** Launch time (ISO 8601 UTC) for the FHIR export. A demo epoch is fictional (SIMULATED). */
    epoch: z.string().datetime().optional(),
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
  /** Imported medical record. Entries before the replay start are on file when it starts. */
  record: z.array(RecordEntry).default([]),
  /** Real lab values from the astronaut's anchors, shown in the record view. */
  labs: z.object({ timepoint: z.string(), measures: z.array(z.string()) }).optional(),
  /** Metric charts to show; all when not set. */
  charts: z.array(z.string()).optional(),
  /** Images that go with a test result, keyed by test ID. */
  testImages: z.record(z.string(), Media).default({}),
  /** Scripted answers, keyed by question ID. Unlisted questions get the default. */
  answers: z.object({ default: z.string(), byQuestion: z.record(z.string(), z.string()) }),
  /** Scripted results of active tests, keyed by test ID. */
  testResults: z.record(
    z.string(),
    z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])),
  ),
});

export type Scenario = z.infer<typeof ScenarioSchema>;
export type ScenarioRecordEntry = z.infer<typeof RecordEntry>;
export type ScenarioMedia = z.infer<typeof Media>;

export function loadScenario(path: string): Scenario {
  return ScenarioSchema.parse(parse(readFileSync(path, "utf8")));
}

/** Scenario references that the catalog must know: scripted results, labs and charts. */
export function scenarioProblems(scenario: Scenario, catalog: Catalog): string[] {
  const problems: string[] = [];
  for (const [testId, values] of Object.entries(scenario.testResults)) {
    const spec = catalog.tests.find((t) => t.id === testId);
    if (!spec) problems.push(`testResults: unknown test ${testId}`);
    else problems.push(...resultProblems(catalog, testId, spec.returns, values));
  }
  for (const m of scenario.labs?.measures ?? [])
    if (!measureDef(catalog, m)) problems.push(`labs: unknown measure ${m}`);
  for (const c of scenario.charts ?? [])
    if (!catalog.measures.some((m) => m.metric === c)) problems.push(`charts: unknown metric ${c}`);
  for (const e of scenario.record)
    if (e.finding && !catalog.findings.some((f) => f.id === e.finding))
      problems.push(`record ${e.id}: unknown finding ${e.finding}`);
  return problems;
}
