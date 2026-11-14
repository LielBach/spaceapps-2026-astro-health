// Domain types for AstroHealth. Terms follow GLOSSARY.md; see docs/technical/09-implementation-plan.md §4.

/** Where a value comes from (ADR 0003). COMPOSITE is a property of an astronaut, not of a value (ADR 0009). */
export const DATA_LABELS = ["REAL", "SIMULATED", "REFERENCE"] as const;
export type DataLabel = (typeof DATA_LABELS)[number];

/** Mission time in days from launch. Negative values are before launch. */
export type MissionDay = number;

/** Passive signals: measured with no action from the astronaut (GLOSSARY: Passive signal). */
export const PASSIVE_SIGNALS = [
  "hr",
  "hrv",
  "respiratoryRate",
  "skinTemp",
  "spo2",
  "activity",
  "exerciseWorkload",
  "exerciseHr",
] as const;
export type PassiveSignal = (typeof PASSIVE_SIGNALS)[number];

/** An ID in sources.json. Every number shown in the UI needs one. */
export type SourceId = string;

export interface Sample {
  t: MissionDay;
  signal: PassiveSignal;
  value: number;
  /** Signal quality from 0 (unusable) to 1 (clean). */
  quality: number;
  label: DataLabel;
  sourceId: SourceId;
  /** What the astronaut was doing: used by the context filter. */
  context?: SampleContext;
}

export type SampleContext =
  | "sleep"
  | "rest"
  | "exercise-standard"
  | "exercise-max"
  | "exercise-free";

export interface Anchor {
  astronautId: string;
  measure: string;
  value: number;
  unit: string;
  /** For example "preflight-erect", "preflight-supine", "inflight". */
  condition: string;
  label: Extract<DataLabel, "REAL" | "REFERENCE">;
  /** Lab reference range, when the source gives one. */
  range?: { min: number; max: number };
  sourceId: SourceId;
}

export interface Astronaut {
  id: string;
  displayName: string;
  /** Set only when real values come from two people (ADR 0009). */
  composite?: { sourceIds: SourceId[]; disclosure: string };
  anchors: Anchor[];
}

export type TriggerKind = "passive" | "surveillance" | "urgent";
export type EventState = "watch" | "investigating" | "acting" | "followUp" | "closed";
export type EventOutcome = "resolved" | "escalated";

export interface HealthEvent {
  id: string;
  astronautId: string;
  trigger: TriggerKind;
  state: EventState;
  openedAt: MissionDay;
  closedAt?: MissionDay;
  outcome?: EventOutcome;
  suspected: SuspectedDiagnosis[];
}

export type StepKind = "question" | "activeTest" | "action" | "followUp" | "escalate";

export interface Step {
  id: string;
  kind: StepKind;
  /** The catalog condition this step belongs to, or "uncatalogued" (ADR 0010). */
  conditionId: string | "uncatalogued";
  rationale: string;
}

export type DiagnosisRef = { conditionId: string } | { uncatalogued: { name: string } };

export interface SuspectedDiagnosis {
  ref: DiagnosisRef;
  /** 0–1. Shown only after the minimum-evidence rule passes (ADR 0005). */
  confidence: number;
  /** Log line IDs. Every ID must exist in the event log (ADR 0010 guardrail). */
  evidenceFor: string[];
  evidenceAgainst: string[];
  confirmingTest?: string;
}

export type Hazard = "radiation" | "isolation" | "distance" | "gravity" | "environment";

export interface CatalogCondition {
  id: string;
  name: string;
  hazard: Hazard;
  hrpRisk: string;
  hrpRiskUrl: string;
  /** Findings that make this condition more likely. */
  supports: string[];
  /** Findings that make it less likely. */
  against: string[];
  /** The approved pathway: questions, tests and actions this condition allows. */
  questions: string[];
  tests: string[];
  actions: CatalogAction[];
  /** Days within which follow-up data must return to baseline, or the event escalates. */
  followUpDays: number;
  /** A record finding that schedules a reassessment under this pathway (plan §5.3 step 6). */
  surveillance?: SurveillanceRule | undefined;
  sourceIds: SourceId[];
}

export interface CatalogAction {
  id: string;
  text: string;
  /** Approving this action hands the event to the crew medical officer and the ground. */
  escalates?: boolean | undefined;
}

/**
 * Surveillance trigger: a finding in the medical record schedules a reassessment within
 * `repeatWithinDays`, with or without a passive-signal change. A silent watch brings it forward.
 */
export interface SurveillanceRule {
  recordFinding: string;
  repeatWithinDays: number;
  earlyOnWatch: boolean;
  sourceId: SourceId;
}

export interface Question {
  id: string;
  text: string;
  yes?: string[] | undefined;
  no?: string[] | undefined;
  keywords?: Record<string, string[]> | undefined;
}

export interface ResultRule {
  field: string;
  op: "lt" | "gt" | "eq";
  value: number | boolean | string;
  finding: string;
}

/** One field of a structured finding that the operator enters (AstroHealth does not read images). */
export interface FormField {
  field: string;
  label: string;
  kind: "boolean" | "select";
  /** For kind select: the allowed values and their labels. */
  options?: { value: number; label: string }[] | undefined;
}

export interface TestSpec {
  id: string;
  name: string;
  equipmentId: string;
  consumable: boolean;
  rules: ResultRule[];
  /** Operator checklist, shown before the test. */
  checklist?: string[] | undefined;
  /** Structured finding form; without one, the device records the result. */
  form?: FormField[] | undefined;
  sourceIds?: SourceId[] | undefined;
}

export interface Catalog {
  conditions: CatalogCondition[];
  questions: Question[];
  tests: TestSpec[];
  redFlags: { finding: string; text: string }[];
}

export type LogStepType =
  | "trigger"
  | "question"
  | "answer"
  | "test"
  | "result"
  | "diagnosis"
  | "action"
  | "followUp"
  | "close"
  | "escalate"
  | "rejected";

/** One line of the event log JSONL (Q18). */
export interface LogLine {
  id: string;
  timestamp: string;
  missionDay: MissionDay;
  eventId: string;
  stepType: LogStepType;
  label: DataLabel;
  conditionId?: string | "uncatalogued";
  stepId?: string;
  llm?: { provider: "anthropic" | "ollama" | "none"; model?: string };
  ruleVersion: string;
  sourceId?: SourceId;
  data: Record<string, unknown>;
}

export function isCatalogued(ref: DiagnosisRef): ref is { conditionId: string } {
  return "conditionId" in ref;
}
