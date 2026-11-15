// What the server sends the web app over SSE (plan §5.2, §6). Shared so both sides agree.
import type { MetricId } from "./detection.ts";
import type { LlmInfo, NextStep, Phase, ShownDiagnosis } from "./investigation.ts";
import type { Catalog, EventOutcome, LogLine } from "./types.ts";

export interface MissionView {
  name: string;
  lengthDays: number;
  replayFromDay: number;
  commDelayMinutes: number;
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
  kind: "ignored" | "watch" | "open" | "urgent" | "cleared" | "baselineUpdated" | "action";
  text: string;
  metric?: MetricId | undefined;
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
}
