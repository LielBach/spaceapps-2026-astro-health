// What the server sends the web app over SSE (plan §5.2, §6). Shared so both sides agree.
import type { MetricId } from "./detection.ts";
import type { LlmInfo, NextStep, Phase, ShownDiagnosis } from "./investigation.ts";
import type { Catalog, DataLabel, EventOutcome, LogLine } from "./types.ts";

export interface MissionView {
  name: string;
  lengthDays: number;
  replayFromDay: number;
  commDelayMinutes: number;
  /** Launch time (ISO 8601 UTC). A demo epoch is fictional (SIMULATED). */
  epoch?: string | undefined;
}

export interface AstronautView {
  id: string;
  displayName: string;
  anchorSources: string[];
  composite?: { sourceIds: string[]; disclosure: string } | undefined;
}

export interface SourceView {
  id: string;
  title: string;
  url: string | null;
  verify: boolean;
  note?: string | undefined;
}

export interface ChartPoint {
  t: number;
  metric: MetricId;
  value: number;
  /** Null inside the baseline window, before the baseline is frozen. */
  baseline: number | null;
  limit: number | null;
  deviating: boolean;
}

export interface Marker {
  t: number;
  kind:
    | "ignored"
    | "watch"
    | "open"
    | "surveillance"
    | "urgent"
    | "cleared"
    | "baselineUpdated"
    | "action";
  text: string;
  metric?: MetricId | undefined;
}

export interface MediaView {
  /** URL path of the image (served from data/reference/). */
  url: string;
  caption: string;
  label: DataLabel;
  sourceId: string;
}

export interface RecordEntryView {
  id: string;
  day: number;
  kind: "imaging" | "note";
  title: string;
  text: string;
  label: DataLabel;
  sourceId: string;
  finding?: string | undefined;
  image?: MediaView | undefined;
}

export interface LabView {
  measure: string;
  value: number;
  unit: string;
  timepoint: string;
  range?: { min: number; max: number } | undefined;
  label: DataLabel;
  sourceId: string;
}

/** A scheduled reassessment from a surveillance trigger. */
export interface SurveillanceView {
  conditionId: string;
  recordEntry: string;
  dueDay: number;
  openedAt: number | undefined;
  sourceId: string;
}

export interface EventView {
  id: string;
  trigger: string;
  phase: Phase;
  outcome: EventOutcome | undefined;
  openedAt: number;
  pending: NextStep | undefined;
  pendingWording: string | undefined;
  diagnoses: ShownDiagnosis[];
  unranked: boolean;
  followUpUntil: number | undefined;
  log: LogLine[];
}

/** One beat of the guided story (presenter mode). */
export interface StoryBeatView {
  title: string;
  /** Talking points for the presenter. */
  say: string[];
  /** Parts of the screen the beat is about: tablet, review, charts, log. */
  focus: string[];
}

/** Presenter mode: the beats and where the presenter is. */
export interface StoryView {
  beats: StoryBeatView[];
  /** Index of the beat on screen; undefined when presenter mode is off. */
  current: number | undefined;
}

export interface SessionView {
  runId: string;
  scenario: { id: string; title: string; mission: MissionView };
  astronaut: AstronautView;
  day: number;
  playing: boolean;
  speed: number;
  blackout: boolean;
  autopilot: boolean;
  waiting: boolean;
  /** The clinical reasoner is working on the next step. */
  reasoning: boolean;
  /** Model name when an LLM reasoner is set up. */
  model: string | undefined;
  provider: LlmInfo["provider"];
  points: ChartPoint[];
  hr: { t: number; value: number; context: string }[];
  markers: Marker[];
  events: EventView[];
  overrides: Record<string, string>;
  scripted: {
    answers: { default: string; byQuestion: Record<string, string> };
    testResults: Record<string, Record<string, number | string | boolean>>;
  };
  catalog: Catalog;
  sources: SourceView[];
  /** Imported medical record (Demo 1): entries on file and real lab values. */
  record: { entries: RecordEntryView[]; labs: LabView[] };
  surveillance: SurveillanceView[];
  /** Metric charts to show; all when undefined. */
  charts: MetricId[] | undefined;
  /** Source of the resting HR the stream starts from: a REAL anchor or an example value. */
  hrBaselineSourceId: string | undefined;
  /** Images for test results, keyed by test ID. */
  testImages: Record<string, MediaView>;
  story: StoryView;
}
