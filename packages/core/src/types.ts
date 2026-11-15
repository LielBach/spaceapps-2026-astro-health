// Domain types for ORBIVIT. Terms follow GLOSSARY.md; see docs/technical/09-implementation-plan.md §4.
// Medical data follows the coded interface in medical.ts (docs/technical/10, ADR 0011).
import type { Mapping, ResultValue, Terminology } from "./medical.ts";

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
  /** A measure ID from catalog/measures.yaml after normalizeAnchors; the source name before. */
  measure: string;
  value: number;
  /** A UCUM code after normalizeAnchors; the source file's spelling before. */
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
  /** SNOMED CT and ICD-10-CM codes with their equivalence (docs/technical/10 §5.4). */
  codes: Mapping[];
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

/** yesNo (default): Yes/No buttons. choice: one of `options`. text: an open answer in own words. */
export type QuestionKind = "yesNo" | "choice" | "text";

export interface QuestionOption {
  label: string;
  /** Findings that choosing this option records. */
  findings?: string[] | undefined;
}

export interface Question {
  id: string;
  text: string;
  kind?: QuestionKind | undefined;
  yes?: string[] | undefined;
  no?: string[] | undefined;
  /** For kind choice: the options, shown as buttons. */
  options?: QuestionOption[] | undefined;
  /** Keywords in a free-text answer that record findings (any kind). */
  keywords?: Record<string, string[]> | undefined;
}

export interface ResultRule {
  /** A measure the test returns. */
  field: string;
  op: "lt" | "gt" | "eq";
  value: number | boolean | string;
  finding: string;
}

/** One field of a structured finding that the operator enters (ORBIVIT does not read images). */
export interface FormField {
  /** A measure the test returns. */
  field: string;
  label: string;
  kind: "boolean" | "select";
  /** For kind select: the allowed values and their labels, from the measure registry. */
  options?: { value: number; label: string }[] | undefined;
}

export interface TestSpec {
  id: string;
  name: string;
  equipmentId: string;
  consumable: boolean;
  /** The measures the test records (catalog/measures.yaml). */
  returns: string[];
  rules: ResultRule[];
  /** Operator checklist, shown before the test. */
  checklist?: string[] | undefined;
  /** Structured finding form; without one, the device records the result. */
  form?: FormField[] | undefined;
  sourceIds?: SourceId[] | undefined;
}

export interface Catalog extends Terminology {
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

/** Why a surveillance event opened (trigger line). */
export interface SurveillanceTriggerData {
  conditionId: string;
  recordEntry: string;
  dueDay: number;
  early: boolean;
  daysEarly: number;
  sourceId: SourceId;
}

/** FHIR R4 Condition.verificationStatus values the app may write (docs/technical/10 rule 8). */
export type VerificationStatus = "differential" | "provisional";

/** The data of each event log step type (docs/technical/10 §4.7). */
export interface LogData {
  trigger: {
    trigger: TriggerKind;
    findings: string[];
    surveillance?: SurveillanceTriggerData | undefined;
  };
  question: { id: string; wording?: string | undefined; rationale?: string | undefined };
  answer: { id: string; text: string; findings: string[] };
  test: { id: string; rationale?: string | undefined };
  result: { id: string; values: ResultValue[]; findings: string[] };
  diagnosis: {
    unranked: boolean;
    diagnoses: {
      name: string;
      conditionId?: string | undefined;
      catalogued: boolean;
      confidence: number;
      verificationStatus: VerificationStatus;
    }[];
  };
  action: { id: string; text?: string | undefined; rationale?: string | undefined };
  followUp: { action: string; until: number };
  close: { outcome: "resolved"; cleared: string[] };
  escalate: { reason: string; action?: string | undefined; text?: string | undefined };
  rejected: { reasons: string[]; proposal?: unknown };
}

interface LogLineBase {
  id: string;
  timestamp: string;
  missionDay: MissionDay;
  eventId: string;
  label: DataLabel;
  conditionId?: string | "uncatalogued";
  stepId?: string;
  llm?: { provider: "anthropic" | "ollama" | "none"; model?: string };
  ruleVersion: string;
  sourceId?: SourceId;
}

/** One line of the event log JSONL (Q18): a typed `data` for each step type. */
export type LogLine = {
  [K in LogStepType]: LogLineBase & { stepType: K; data: LogData[K] };
}[LogStepType];

/** A log line of one step type. */
export type LogLineOf<K extends LogStepType> = Extract<LogLine, { stepType: K }>;

export function isStep<K extends LogStepType>(line: LogLine, stepType: K): line is LogLineOf<K> {
  return line.stepType === stepType;
}

/** The data of a log line when it has this step type, else undefined. */
export function dataOf<K extends LogStepType>(
  line: LogLine | undefined,
  stepType: K,
): LogData[K] | undefined {
  return line?.stepType === stepType ? (line.data as LogData[K]) : undefined;
}

export function isCatalogued(ref: DiagnosisRef): ref is { conditionId: string } {
  return "conditionId" in ref;
}
