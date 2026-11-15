// The standard medical data interface (docs/technical/10, ADR 0011): coded measures, UCUM units,
// explicit mappings to standard code systems. A small subset of HL7 FHIR R4, not a FHIR library.
import type { DataLabel, MissionDay, SampleContext, SourceId } from "./types.ts";

export const CODE_SYSTEMS = {
  loinc: "http://loinc.org",
  snomed: "http://snomed.info/sct",
  icd10cm: "http://hl7.org/fhir/sid/icd-10-cm",
  mdc: "urn:iso:std:iso:11073:10101",
  ucum: "http://unitsofmeasure.org",
  measure: "urn:astrohealth:measure",
  finding: "urn:astrohealth:finding",
  condition: "urn:astrohealth:condition",
} as const;

export type CodeSystemKey = keyof typeof CODE_SYSTEMS;
/** Code systems that a registry may map to. */
export const STANDARD_SYSTEMS = ["loinc", "snomed", "icd10cm", "mdc"] as const;
export type StandardSystem = (typeof STANDARD_SYSTEMS)[number];

/** The sources.json entry that backs each standard code system (CLAUDE.md: every code has a source). */
export const SYSTEM_SOURCES: Record<StandardSystem | "ucum", SourceId> = {
  loinc: "loinc",
  snomed: "snomed-ct",
  icd10cm: "icd-10-cm",
  mdc: "ieee-11073-10101",
  ucum: "ucum",
};

export const SYSTEM_NAMES: Record<StandardSystem, string> = {
  loinc: "LOINC",
  snomed: "SNOMED CT",
  icd10cm: "ICD-10-CM",
  mdc: "IEEE 11073",
};

/** FHIR R4 ConceptMap equivalence, read from the local code to the target code. */
export const EQUIVALENCES = ["equivalent", "wider", "narrower", "inexact", "unmatched"] as const;
export type Equivalence = (typeof EQUIVALENCES)[number];

/**
 * The nearest standard code for a local code. `wider`: the target means more than the local code.
 * `narrower`: the target means less. `unmatched`: no code; `note` says why.
 */
export interface Mapping {
  system: StandardSystem;
  code?: string | undefined;
  display?: string | undefined;
  equivalence: Equivalence;
  note?: string | undefined;
}

export interface Coding {
  system: string;
  code: string;
  display: string;
}

/** A UCUM unit on the allowlist (catalog/units.yaml). */
export interface UnitDef {
  /** The UCUM code, for example "/min" or "10*3/uL". */
  code: string;
  /** What the UI shows, for example "bpm". */
  display: string;
  /** Unit spellings in source files that mean this unit, for example "Thousand/uL". */
  aliases?: string[] | undefined;
}

export type ObservationCategory =
  | "vital-signs"
  | "laboratory"
  | "activity"
  | "exam"
  | "survey"
  | "imaging"
  | "procedure"
  | "environment";

/** panel: a group of component measures with no value of its own (for example blood pressure). */
export type MeasureValueType = "quantity" | "boolean" | "string" | "panel";

/** One kind of thing that is measured (GLOSSARY: Measure). */
export interface MeasureDef {
  id: string;
  display: string;
  category: ObservationCategory;
  valueType: MeasureValueType;
  /** UCUM code (quantity only). */
  unit?: string | undefined;
  /** Overrides the unit's display for this measure, for example "breaths/min". */
  displayUnit?: string | undefined;
  /** How a derived measure is computed: window, context, aggregation. */
  definition?: string | undefined;
  /** Measure names in source files (anchors) that mean this measure. */
  aliases?: string[] | undefined;
  /** The stream signal that carries this measure. */
  signal?: string | undefined;
  /** The detection metric that computes this measure. */
  metric?: string | undefined;
  /** For a panel: the component measures, in order. */
  components?: string[] | undefined;
  /** Labels of coded numeric values, for example IJV flow grades. */
  options?: { value: number; label: string }[] | undefined;
  mappings: Mapping[];
}

/** One finding the investigation engine uses, with its clinical code. */
export interface FindingDef {
  id: string;
  display: string;
  /** "absent": the finding asserts that the mapped concept is absent (SNOMED CT 2667000). */
  polarity?: "present" | "absent" | undefined;
  mappings: Mapping[];
}

export interface Terminology {
  units: UnitDef[];
  measures: MeasureDef[];
  findings: FindingDef[];
}

export type MeasuredValue = number | boolean | string;

/** A test result value as the event log stores it: measure ID, value and UCUM unit. */
export interface ResultValue {
  measure: string;
  value: MeasuredValue;
  unit?: string | undefined;
}

/** Where a datum came from (docs/technical/10 rule 4). */
export type Origin = "stream" | "anchor" | "device" | "operator" | "astronaut" | "reasoner";

export type RangeType = "lab-reference" | "personal-baseline" | "reference-band" | "alert-limit";

export const RANGE_WORDS: Record<RangeType, string> = {
  "lab-reference": "lab reference",
  "personal-baseline": "personal baseline",
  "reference-band": "other astronauts",
  "alert-limit": "alert limit",
};

export interface Range {
  type: RangeType;
  low?: number | undefined;
  high?: number | undefined;
  sourceId: SourceId;
}

export type MeasurementStatus = "final" | "preliminary" | "amended" | "entered-in-error";

/** One value of a measure for one astronaut at one mission time (GLOSSARY: Measurement). */
export interface Measurement {
  id: string;
  subject: string;
  measure: string;
  value: MeasuredValue;
  /** UCUM code, for a quantity. */
  unit?: string | undefined;
  missionDay: MissionDay;
  context?: SampleContext | string | undefined;
  status: MeasurementStatus;
  ranges?: Range[] | undefined;
  label: DataLabel;
  sourceId: SourceId;
  origin: Origin;
  deviceId?: string | undefined;
}

// ---------- Lookups ----------

export function measureDef(t: Terminology, id: string): MeasureDef | undefined {
  return t.measures.find((m) => m.id === id);
}

export function unitDef(t: Terminology, code: string): UnitDef | undefined {
  return t.units.find((u) => u.code === code);
}

/** The UCUM code for a unit spelling from a source file, or undefined when it is not known. */
export function toUcum(t: Terminology, sourceUnit: string): string | undefined {
  return t.units.find((u) => u.code === sourceUnit || (u.aliases ?? []).includes(sourceUnit))?.code;
}

/** The registry measure ID for a measure name from a source file, or the name itself. */
export function toMeasureId(t: Terminology, sourceMeasure: string): string {
  return (
    t.measures.find((m) => m.id === sourceMeasure || (m.aliases ?? []).includes(sourceMeasure))
      ?.id ?? sourceMeasure
  );
}

/** The unit text the UI shows for a measure. */
export function displayUnit(
  t: Terminology,
  measure: MeasureDef | undefined,
  unit?: string,
): string {
  if (measure?.displayUnit) return measure.displayUnit;
  const code = unit ?? measure?.unit;
  if (!code) return "";
  return unitDef(t, code)?.display ?? code;
}

/** "Systolic BP 118 mmHg", "Thrombus seen: yes", "IJV flow grade 3 (stagnant)". */
export function formatValue(t: Terminology, v: ResultValue): string {
  const m = measureDef(t, v.measure);
  const name = m?.display ?? v.measure;
  if (typeof v.value === "boolean") return `${name}: ${v.value ? "yes" : "no"}`;
  if (typeof v.value === "string") return `${name}: ${v.value}`;
  const option = m?.options?.find((o) => o.value === v.value);
  if (option) return `${name} ${option.label}`;
  const unit = displayUnit(t, m, v.unit);
  return `${name} ${v.value}${unit ? ` ${unit}` : ""}`;
}

/** Converts raw test values (keyed by measure ID) to coded result values with their units. */
export function toResultValues(
  t: Terminology,
  values: Record<string, MeasuredValue>,
): ResultValue[] {
  return Object.entries(values).map(([measure, value]) => {
    const unit = measureDef(t, measure)?.unit;
    return unit ? { measure, value, unit } : { measure, value };
  });
}

/** The URL of a code's public page, when the code system has one. */
export function codeUrl(m: Mapping): string | undefined {
  if (!m.code) return undefined;
  if (m.system === "loinc") return `https://loinc.org/${m.code}`;
  if (m.system === "snomed")
    return `https://browser.ihtsdotools.org/?perspective=full&conceptId1=${m.code}&edition=MAIN&languages=en`;
  return undefined;
}

/** Mapping problems: a coded mapping needs a code and display; `unmatched` needs a reason. */
export function mappingProblems(owner: string, mappings: Mapping[]): string[] {
  const problems: string[] = [];
  for (const m of mappings) {
    if (!(STANDARD_SYSTEMS as readonly string[]).includes(m.system))
      problems.push(`${owner}: unknown code system ${m.system}`);
    if (m.equivalence === "unmatched") {
      if (m.code) problems.push(`${owner}: an unmatched mapping has no code (${m.code})`);
      if (!m.note) problems.push(`${owner}: an unmatched ${m.system} mapping needs a note`);
    } else if (!m.code || !m.display) {
      problems.push(
        `${owner}: the ${m.system} mapping (${m.equivalence}) needs a code and a display`,
      );
    }
  }
  if (mappings.length === 0) problems.push(`${owner}: no mapping (use unmatched with a note)`);
  return problems;
}
