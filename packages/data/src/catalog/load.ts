import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import type { Catalog } from "@astrohealth/core";

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

export function loadCatalog(dir: string): Catalog {
  const questions = Questions.parse(yamlFile(join(dir, "questions.yaml"))).questions;
  const equipment = Equipment.parse(yamlFile(join(dir, "equipment.yaml"))).equipment;
  const redFlags = RedFlags.parse(yamlFile(join(dir, "red-flags.yaml"))).redFlags;
  const conditions = readdirSync(join(dir, "conditions"))
    .filter((f) => f.endsWith(".yaml"))
    .sort()
    .map((f) => Condition.parse(yamlFile(join(dir, "conditions", f))));
  const tests = equipment.flatMap((e) =>
    e.tests.map((t) => ({ ...t, equipmentId: e.id, consumable: e.consumable })),
  );
  const catalog: Catalog = { conditions, questions, tests, redFlags };
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
  return problems;
}
