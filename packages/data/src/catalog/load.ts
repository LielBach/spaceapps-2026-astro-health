import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import {
  DEFAULT_DETECTION,
  EQUIVALENCES,
  PASSIVE_SIGNALS,
  STANDARD_SYSTEMS,
  mappingProblems,
  measureDef,
  type Catalog,
  type Terminology,
} from "@orbivit/core";

const MappingSchema = z.object({
  system: z.enum(STANDARD_SYSTEMS),
  code: z.string().optional(),
  display: z.string().optional(),
  equivalence: z.enum(EQUIVALENCES),
  note: z.string().optional(),
});

const Units = z.object({
  units: z.array(
    z.object({ code: z.string(), display: z.string(), aliases: z.array(z.string()).optional() }),
  ),
});

const Measures = z.object({
  measures: z.array(
    z.object({
      id: z.string().regex(/^[a-z0-9-]+$/),
      display: z.string(),
      category: z.enum([
        "vital-signs",
        "laboratory",
        "activity",
        "exam",
        "survey",
        "imaging",
        "procedure",
        "environment",
      ]),
      valueType: z.enum(["quantity", "boolean", "string", "panel"]),
      components: z.array(z.string()).optional(),
      unit: z.string().optional(),
      displayUnit: z.string().optional(),
      definition: z.string().optional(),
      aliases: z.array(z.string()).optional(),
      signal: z.string().optional(),
      metric: z.string().optional(),
      options: z.array(z.object({ value: z.number(), label: z.string() })).optional(),
      mappings: z.array(MappingSchema),
    }),
  ),
});

const Findings = z.object({
  findings: z.array(
    z.object({
      id: z.string().regex(/^f-[a-z0-9-]+$/),
      display: z.string(),
      polarity: z.enum(["present", "absent"]).optional(),
      mappings: z.array(MappingSchema),
    }),
  ),
});

const Rule = z.object({
  field: z.string(),
  op: z.enum(["lt", "gt", "eq"]),
  value: z.union([z.number(), z.boolean(), z.string()]),
  finding: z.string(),
});

const Questions = z.object({
  questions: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      yes: z.array(z.string()).optional(),
      no: z.array(z.string()).optional(),
      keywords: z.record(z.string(), z.array(z.string())).optional(),
    }),
  ),
});

const Equipment = z.object({
  equipment: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      consumable: z.boolean(),
      tests: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          returns: z.array(z.string()).min(1),
          rules: z.array(Rule),
          checklist: z.array(z.string()).optional(),
          form: z
            .array(
              z.object({
                field: z.string(),
                label: z.string(),
                kind: z.enum(["boolean", "select"]),
                options: z.array(z.object({ value: z.number(), label: z.string() })).optional(),
              }),
            )
            .optional(),
          sourceIds: z.array(z.string()).optional(),
        }),
      ),
    }),
  ),
});

const RedFlags = z.object({
  redFlags: z.array(z.object({ finding: z.string(), text: z.string() })),
});

const Condition = z.object({
  id: z.string(),
  name: z.string(),
  hazard: z.enum(["radiation", "isolation", "distance", "gravity", "environment"]),
  hrpRisk: z.string(),
  hrpRiskUrl: z.string().url(),
  codes: z.array(MappingSchema).min(1),
  supports: z.array(z.string()).min(1),
  against: z.array(z.string()),
  questions: z.array(z.string()),
  tests: z.array(z.string()),
  actions: z
    .array(z.object({ id: z.string(), text: z.string(), escalates: z.boolean().optional() }))
    .min(1),
  followUpDays: z.number().positive(),
  surveillance: z
    .object({
      recordFinding: z.string(),
      repeatWithinDays: z.number().positive(),
      earlyOnWatch: z.boolean(),
      sourceId: z.string(),
    })
    .optional(),
  sourceIds: z.array(z.string()).min(1),
});

/** Findings produced by the detection engine or the medical record, not by a question or test. */
export const SIGNAL_FINDINGS = [
  "f-exercise-hr-up",
  "f-max-workload-down",
  "f-sleeping-hr-up",
  "f-hrv-down",
  "f-skin-temp-up",
  "f-rr-up",
  "f-resting-hr-in-band",
  "f-prior-ijv-flow-abnormal",
] as const;

const yamlFile = (path: string): unknown => parse(readFileSync(path, "utf8"));

export function loadTerminology(dir: string): Terminology {
  return {
    units: Units.parse(yamlFile(join(dir, "units.yaml"))).units,
    measures: Measures.parse(yamlFile(join(dir, "measures.yaml"))).measures,
    findings: Findings.parse(yamlFile(join(dir, "findings.yaml"))).findings,
  };
}

export function loadCatalog(dir: string): Catalog {
  const terminology = loadTerminology(dir);
  const questions = Questions.parse(yamlFile(join(dir, "questions.yaml"))).questions;
  const equipment = Equipment.parse(yamlFile(join(dir, "equipment.yaml"))).equipment;
  const redFlags = RedFlags.parse(yamlFile(join(dir, "red-flags.yaml"))).redFlags;
  const conditions = readdirSync(join(dir, "conditions"))
    .filter((f) => f.endsWith(".yaml"))
    .sort()
    .map((f) => Condition.parse(yamlFile(join(dir, "conditions", f))));
  const tests = equipment.flatMap((e) =>
    e.tests.map((t) => ({
      ...t,
      equipmentId: e.id,
      consumable: e.consumable,
      // A select field takes its options from the measure registry (one source for labels).
      form: t.form?.map((f) =>
        f.kind === "select" && !f.options
          ? { ...f, options: measureDef(terminology, f.field)?.options }
          : f,
      ),
    })),
  );
  const catalog: Catalog = { ...terminology, conditions, questions, tests, redFlags };
  const problems = validateCatalog(catalog);
  if (problems.length > 0) throw new Error(`catalog is inconsistent:\n${problems.join("\n")}`);
  return catalog;
}

/** Every finding, question and test that a condition names must exist somewhere. */
export function validateCatalog(catalog: Catalog): string[] {
  const findings = new Set<string>(SIGNAL_FINDINGS);
  for (const q of catalog.questions) {
    for (const f of [...(q.yes ?? []), ...(q.no ?? []), ...Object.values(q.keywords ?? {}).flat()])
      findings.add(f);
  }
  for (const t of catalog.tests) for (const r of t.rules) findings.add(r.finding);
  const questionIds = new Set(catalog.questions.map((q) => q.id));
  const testIds = new Set(catalog.tests.map((t) => t.id));
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const c of catalog.conditions) {
    if (ids.has(c.id)) problems.push(`duplicate condition ${c.id}`);
    ids.add(c.id);
    for (const f of [...c.supports, ...c.against]) {
      if (!findings.has(f)) problems.push(`${c.id}: unknown finding ${f}`);
    }
    for (const q of c.questions)
      if (!questionIds.has(q)) problems.push(`${c.id}: unknown question ${q}`);
    for (const t of c.tests) if (!testIds.has(t)) problems.push(`${c.id}: unknown test ${t}`);
    if (c.surveillance && !c.supports.includes(c.surveillance.recordFinding))
      problems.push(
        `${c.id}: surveillance finding ${c.surveillance.recordFinding} is not in supports`,
      );
  }
  for (const r of catalog.redFlags)
    if (!findings.has(r.finding)) problems.push(`red flag: unknown finding ${r.finding}`);
  return [...problems, ...terminologyProblems(catalog, findings)];
}

/** Findings the detection engine emits (metrics and urgent thresholds). */
function detectionFindings(): string[] {
  return [
    ...DEFAULT_DETECTION.metrics.map((m) => m.finding),
    "f-resting-hr-critical",
    "f-spo2-low",
  ];
}

/**
 * Terminology checks (docs/technical/10 §4.2): every unit is on the UCUM allowlist, every
 * measure and finding in use is in a registry, and every mapping is complete.
 */
export function terminologyProblems(catalog: Catalog, usedFindings: Set<string>): string[] {
  const problems: string[] = [];
  const unitCodes = new Set<string>();
  const aliases = new Set<string>();
  for (const u of catalog.units) {
    if (unitCodes.has(u.code)) problems.push(`units: duplicate ${u.code}`);
    unitCodes.add(u.code);
    for (const a of u.aliases ?? []) {
      if (aliases.has(a)) problems.push(`units: duplicate alias ${a}`);
      aliases.add(a);
    }
  }
  const measureIds = new Set<string>();
  const signals = new Map<string, string>();
  const metrics = new Map<string, string>();
  for (const m of catalog.measures) {
    if (measureIds.has(m.id)) problems.push(`measures: duplicate ${m.id}`);
    measureIds.add(m.id);
    if (m.valueType === "quantity" && !m.unit) problems.push(`measure ${m.id}: needs a unit`);
    if (m.valueType !== "quantity" && m.unit)
      problems.push(`measure ${m.id}: only a quantity has a unit`);
    if (m.unit && !unitCodes.has(m.unit))
      problems.push(`measure ${m.id}: unit ${m.unit} is not on the UCUM allowlist`);
    if (m.signal) {
      if (!(PASSIVE_SIGNALS as readonly string[]).includes(m.signal))
        problems.push(`measure ${m.id}: unknown signal ${m.signal}`);
      if (signals.has(m.signal)) problems.push(`signal ${m.signal}: two measures`);
      signals.set(m.signal, m.id);
    }
    if (m.metric) {
      if (!DEFAULT_DETECTION.metrics.some((x) => x.id === m.metric))
        problems.push(`measure ${m.id}: unknown metric ${m.metric}`);
      if (metrics.has(m.metric)) problems.push(`metric ${m.metric}: two measures`);
      metrics.set(m.metric, m.id);
    }
    if ((m.valueType === "panel") !== (m.components !== undefined))
      problems.push(`measure ${m.id}: a panel, and only a panel, lists components`);
    problems.push(...mappingProblems(`measure ${m.id}`, m.mappings));
  }
  for (const m of catalog.measures)
    for (const c of m.components ?? [])
      if (!measureIds.has(c)) problems.push(`measure ${m.id}: unknown component ${c}`);
  for (const s of PASSIVE_SIGNALS)
    if (!signals.has(s)) problems.push(`signal ${s}: no measure in measures.yaml`);
  for (const x of DEFAULT_DETECTION.metrics)
    if (!metrics.has(x.id)) problems.push(`metric ${x.id}: no measure in measures.yaml`);
  for (const t of catalog.tests) {
    for (const r of t.returns)
      if (!measureIds.has(r)) problems.push(`${t.id}: returns unknown measure ${r}`);
    for (const r of t.rules)
      if (!t.returns.includes(r.field))
        problems.push(`${t.id}: rule field ${r.field} is not returned`);
    for (const f of t.form ?? []) {
      if (!t.returns.includes(f.field))
        problems.push(`${t.id}: form field ${f.field} is not returned`);
      if (f.kind === "select" && !f.options?.length)
        problems.push(`${t.id}: select ${f.field} has no options`);
    }
  }
  const findingIds = new Set<string>();
  for (const f of catalog.findings) {
    if (findingIds.has(f.id)) problems.push(`findings: duplicate ${f.id}`);
    findingIds.add(f.id);
    problems.push(...mappingProblems(`finding ${f.id}`, f.mappings));
  }
  for (const f of [...usedFindings, ...detectionFindings()])
    if (!findingIds.has(f)) problems.push(`finding ${f}: not in findings.yaml`);
  for (const f of findingIds)
    if (!usedFindings.has(f) && !detectionFindings().includes(f))
      problems.push(`finding ${f}: in findings.yaml but never used`);
  for (const c of catalog.conditions) {
    problems.push(...mappingProblems(`condition ${c.id}`, c.codes));
    for (const system of ["snomed", "icd10cm"] as const)
      if (!c.codes.some((m) => m.system === system))
        problems.push(`condition ${c.id}: no ${system} mapping (use unmatched with a note)`);
  }
  return problems;
}
