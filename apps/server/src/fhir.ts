// FHIR R4 export of one replay run (docs/technical/10 §4.8, ADR 0011): one Bundle of type
// "collection" that can be saved during a comm blackout and sent to the ground in one transfer.
// A projection of the session view: it adds no clinical content of its own. It uses no custom
// extensions, so the HL7 validator can check every element:
//   - mapping equivalence → ConceptMap resources (one per local code system and target)
//   - confidence → RiskAssessment.prediction.probabilityDecimal
//   - mission time → effectiveDateTime from the mission epoch; the mission is an Encounter
//   - alarm priority → Flag.category
import { createHash } from "node:crypto";
import {
  CODE_SYSTEMS,
  DEFAULT_DETECTION,
  STANDARD_SYSTEMS,
  isStep,
  measureDef,
  type Catalog,
  type DataLabel,
  type EventView,
  type LogLine,
  type Mapping,
  type MeasureDef,
  type ResultValue,
  type SessionView,
  type StandardSystem,
} from "@orbivit/core";

type Resource = Record<string, unknown> & { resourceType: string; id: string };

const DATA_LABEL = "urn:orbivit:data-label";
const OBS_CATEGORY = "http://terminology.hl7.org/CodeSystem/observation-category";
const VER_STATUS = "http://terminology.hl7.org/CodeSystem/condition-ver-status";
const CLINICAL_STATUS = "http://terminology.hl7.org/CodeSystem/condition-clinical";
const INTERPRETATION = "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation";
const RANGE_MEANING = "http://terminology.hl7.org/CodeSystem/referencerange-meaning";
const ACT_CODE = "http://terminology.hl7.org/CodeSystem/v3-ActCode";
const DATA_OPERATION = "http://terminology.hl7.org/CodeSystem/v3-DataOperation";
const SNOMED_PRESENT = { system: CODE_SYSTEMS.snomed, code: "52101004", display: "Present" };
const SNOMED_ABSENT = { system: CODE_SYSTEMS.snomed, code: "2667000", display: "Absent" };

/** Observation categories outside the HL7 category code system. */
const LOCAL_CATEGORIES = new Set(["environment"]);

/** A stable urn:uuid for a resource, so references and repeated exports agree. */
function uuid(runId: string, key: string): string {
  const h = createHash("sha1").update(`${runId}/${key}`).digest("hex");
  const variant = ((parseInt(h.slice(16, 18), 16) & 0x3f) | 0x80).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(18, 20)}-${h.slice(20, 32)}`;
}

/** meta.tag with the data labels, or nothing (FHIR arrays must not be empty). */
function meta(...labels: (DataLabel | "COMPOSITE" | "UNCATALOGUED" | undefined)[]) {
  const tags = labels.filter(Boolean).map((code) => ({ system: DATA_LABEL, code }));
  return tags.length > 0 ? { meta: { tag: tags } } : {};
}

/**
 * Local code first, then the standard codes a FHIR system may read as this concept: equivalent
 * codes, and wider codes (the local code is a more specific kind of it, as the vital signs
 * profiles expect). Narrower and inexact codes appear only in the ConceptMaps.
 */
function concept(localSystem: string, localCode: string, display: string, mappings: Mapping[]) {
  return {
    coding: [
      { system: localSystem, code: localCode, display },
      ...mappings
        .filter((m) => (m.equivalence === "equivalent" || m.equivalence === "wider") && m.code)
        .map((m) => ({ system: CODE_SYSTEMS[m.system], code: m.code, display: m.display })),
    ],
    text: display,
  };
}

function category(measure: MeasureDef | undefined) {
  const code = measure?.category ?? "exam";
  const system = LOCAL_CATEGORIES.has(code) ? "urn:orbivit:observation-category" : OBS_CATEGORY;
  return [{ coding: [{ system, code }] }];
}

function quantity(catalog: Catalog, v: number, code: string | undefined) {
  const display = code ? (catalog.units.find((u) => u.code === code)?.display ?? code) : "";
  return {
    value: v,
    ...(display ? { unit: display } : {}),
    ...(code ? { system: CODE_SYSTEMS.ucum, code } : {}),
  };
}

function value(catalog: Catalog, v: ResultValue["value"], unit: string | undefined) {
  if (typeof v === "boolean") return { valueBoolean: v };
  if (typeof v === "string") return { valueString: v };
  return { valueQuantity: quantity(catalog, v, unit) };
}

/** ConceptMap rule cmd-1: a narrower or inexact mapping needs a comment. */
const DEFAULT_COMMENTS: Partial<Record<Mapping["equivalence"], string>> = {
  narrower: "The target code is more specific than the ORBIVIT code; use it only when confirmed.",
  inexact: "The target code overlaps the ORBIVIT code but is not the same concept.",
};

/** One ConceptMap per local code system and standard target system, with every equivalence. */
function conceptMaps(catalog: Catalog): Resource[] {
  const sources = [
    { key: "measure", items: catalog.measures.map((m) => ({ ...m, mappings: m.mappings })) },
    { key: "finding", items: catalog.findings },
    {
      key: "condition",
      items: catalog.conditions.map((c) => ({ id: c.id, display: c.name, mappings: c.codes })),
    },
  ] as const;
  const maps: Resource[] = [];
  for (const { key, items } of sources) {
    for (const target of STANDARD_SYSTEMS as readonly StandardSystem[]) {
      const elements = items
        .map((item) => ({
          code: item.id,
          display: item.display,
          target: item.mappings
            .filter((m) => m.system === target)
            .map((m) => {
              const comment = m.note ?? DEFAULT_COMMENTS[m.equivalence];
              return {
                ...(m.code ? { code: m.code, display: m.display } : {}),
                equivalence: m.equivalence,
                ...(comment ? { comment } : {}),
                // An "absent" finding maps to the same concept, with the value Absent.
                ...("polarity" in item && item.polarity === "absent" && m.code
                  ? {
                      product: [
                        {
                          property:
                            "http://hl7.org/fhir/StructureDefinition/Observation#Observation.value[x]",
                          system: SNOMED_ABSENT.system,
                          value: SNOMED_ABSENT.code,
                          display: SNOMED_ABSENT.display,
                        },
                      ],
                    }
                  : {}),
              };
            }),
        }))
        .filter((e) => e.target.length > 0);
      if (elements.length === 0) continue;
      maps.push({
        resourceType: "ConceptMap",
        id: `orbivit-${key}-to-${target}`,
        url: `urn:orbivit:conceptmap:${key}-to-${target}`,
        name: `ORBIVIT${key[0]!.toUpperCase()}${key.slice(1)}To${target.toUpperCase()}`,
        status: "draft",
        description: `ORBIVIT ${key} codes mapped to ${target} with their equivalence (docs/technical/10).`,
        group: [{ source: CODE_SYSTEMS[key], target: CODE_SYSTEMS[target], element: elements }],
      });
    }
  }
  return maps;
}

export function toFhirBundle(view: SessionView, now: Date = new Date()): Resource {
  const { catalog, runId } = view;
  const { mission } = view.scenario;
  if (!mission.epoch)
    throw new Error(`scenario ${view.scenario.id} has no mission epoch; the FHIR export needs one`);
  const epoch = Date.parse(mission.epoch);
  const entries: Resource[] = [];
  const ref = (type: string, id: string) => `urn:uuid:${uuid(runId, `${type}/${id}`)}`;
  /** Mission day → ISO 8601 UTC. The mission Encounter starts at the epoch (rule 5). */
  const at = (missionDay: number) => new Date(epoch + missionDay * 86_400_000).toISOString();
  const patient = { reference: ref("Patient", view.astronaut.id) };
  const encounter = { reference: ref("Encounter", "mission") };
  const composite = view.astronaut.composite ? "COMPOSITE" : undefined;

  entries.push({
    resourceType: "Patient",
    id: view.astronaut.id,
    ...meta(composite),
    identifier: [{ system: "urn:orbivit:astronaut", value: view.astronaut.id }],
    name: [{ text: `${view.astronaut.displayName} (demo name)` }],
  });
  entries.push({
    resourceType: "Encounter",
    id: "mission",
    ...meta("SIMULATED"),
    status: view.day >= mission.lengthDays ? "finished" : "in-progress",
    class: { system: ACT_CODE, code: "FLD", display: "field" },
    type: [{ text: `${mission.name} (launch time is fictional)` }],
    subject: patient,
    period: { start: mission.epoch },
  });

  for (const equipmentId of [...new Set(catalog.tests.map((t) => t.equipmentId))]) {
    entries.push({
      resourceType: "Device",
      id: equipmentId,
      identifier: [{ system: "urn:orbivit:equipment", value: equipmentId }],
      type: { text: equipmentId },
    });
  }

  const observation = (
    id: string,
    measureId: string,
    missionDay: number,
    label: DataLabel,
    body: Record<string, unknown>,
  ): Resource => {
    const measure = measureDef(catalog, measureId);
    return {
      resourceType: "Observation",
      id,
      ...meta(label),
      status: "final",
      category: category(measure),
      code: concept(
        CODE_SYSTEMS.measure,
        measureId,
        measure?.display ?? measureId,
        measure?.mappings ?? [],
      ),
      subject: patient,
      encounter,
      effectiveDateTime: at(missionDay),
      ...body,
    };
  };

  // Real labs from the imported record. "L-3" means 3 days before launch.
  for (const lab of view.record.labs) {
    const day = /^L-(\d+)$/.exec(lab.timepoint);
    entries.push(
      observation(
        `lab-${lab.measure}-${lab.timepoint}`,
        lab.measure,
        day ? -Number(day[1]) : 0,
        lab.label,
        {
          ...value(catalog, lab.value, lab.unit),
          ...(lab.range
            ? {
                referenceRange: [
                  {
                    low: quantity(catalog, lab.range.min, lab.unit),
                    high: quantity(catalog, lab.range.max, lab.unit),
                    type: {
                      coding: [{ system: RANGE_MEANING, code: "normal" }],
                      text: "lab reference",
                    },
                  },
                ],
              }
            : {}),
        },
      ),
    );
  }

  // Detection metric values, with the illustrative alert limit and the personal baseline.
  view.points.forEach((p, i) => {
    const measure = catalog.measures.find((m) => m.metric === p.metric);
    const spec = DEFAULT_DETECTION.metrics.find((m) => m.id === p.metric);
    if (!measure || !spec) return;
    const limit = p.limit === null ? undefined : quantity(catalog, p.limit, measure.unit);
    entries.push(
      observation(`metric-${p.metric}-${i}`, measure.id, p.t, "SIMULATED", {
        ...value(catalog, p.value, measure.unit),
        ...(limit
          ? {
              referenceRange: [
                {
                  ...(spec.direction === "up" ? { high: limit } : { low: limit }),
                  type: { coding: [{ system: "urn:orbivit:range-type", code: "alert-limit" }] },
                  text: `alert limit (illustrative design parameter); personal baseline ${p.baseline}`,
                },
              ],
            }
          : {}),
        ...(p.deviating
          ? {
              interpretation: [
                {
                  coding: [{ system: INTERPRETATION, code: spec.direction === "down" ? "L" : "H" }],
                  text: "outside the personal band",
                },
              ],
            }
          : {}),
      }),
    );
  });

  const questionnaire = "urn:orbivit:questionnaire:check-in";
  entries.push({
    resourceType: "Questionnaire",
    id: "check-in",
    url: questionnaire,
    status: "draft",
    title: "ORBIVIT check-in questions (catalog draft)",
    item: catalog.questions.map((q) => {
      const codes = (q.yes ?? []).flatMap(
        (f) =>
          catalog.findings
            .find((x) => x.id === f)
            ?.mappings.filter((m) => m.code && m.equivalence === "equivalent")
            .map((m) => ({ system: CODE_SYSTEMS[m.system], code: m.code, display: m.display })) ??
          [],
      );
      return {
        linkId: q.id,
        text: q.text,
        type: "string",
        ...(codes.length > 0 ? { code: codes } : {}),
      };
    }),
  });

  for (const event of view.events) exportEvent(event);
  entries.push(...conceptMaps(catalog));

  /** A finding as a coded Observation: present or absent (SNOMED CT 52101004 / 2667000). */
  function finding(id: string, line: LogLine) {
    const def = catalog.findings.find((f) => f.id === id);
    entries.push({
      resourceType: "Observation",
      id: `${line.id}-${id}`,
      ...meta(line.label),
      status: "final",
      category: [
        {
          coding: [{ system: OBS_CATEGORY, code: line.stepType === "answer" ? "survey" : "exam" }],
        },
      ],
      code: concept(CODE_SYSTEMS.finding, id, def?.display ?? id, def?.mappings ?? []),
      subject: patient,
      encounter,
      effectiveDateTime: at(line.missionDay),
      valueCodeableConcept: {
        coding: [def?.polarity === "absent" ? SNOMED_ABSENT : SNOMED_PRESENT],
      },
      derivedFrom: [{ identifier: { system: "urn:orbivit:event-log", value: line.id } }],
    });
  }

  /** Test values; a panel's components (for example blood pressure) become one Observation. */
  function results(line: Extract<LogLine, { stepType: "result" }>) {
    const spec = catalog.tests.find((t) => t.id === line.data.id);
    const device = { reference: ref("Device", spec?.equipmentId ?? "unknown") };
    // An operator-entered structured finding stays preliminary until the CMO reviews it.
    const status = spec?.form ? "preliminary" : "final";
    const values = [...line.data.values];
    for (const panel of catalog.measures.filter((m) => m.valueType === "panel")) {
      const parts = (panel.components ?? []).map((c) => values.find((v) => v.measure === c));
      if (parts.some((p) => p === undefined)) continue;
      entries.push(
        observation(`${line.id}-${panel.id}`, panel.id, line.missionDay, line.label, {
          status,
          device,
          component: parts.map((v) => {
            const m = measureDef(catalog, v!.measure);
            return {
              code: concept(
                CODE_SYSTEMS.measure,
                v!.measure,
                m?.display ?? v!.measure,
                m?.mappings ?? [],
              ),
              ...value(catalog, v!.value, v!.unit),
            };
          }),
        }),
      );
      for (const v of parts) values.splice(values.indexOf(v!), 1);
    }
    for (const v of values)
      entries.push(
        observation(`${line.id}-${v.measure}`, v.measure, line.missionDay, line.label, {
          status,
          device,
          ...value(catalog, v.value, v.unit),
        }),
      );
  }

  function exportEvent(event: EventView) {
    const log = event.log;
    const first = log[0];
    const trigger = first && isStep(first, "trigger") ? first.data : undefined;
    // IEC 60601-1-8 alarm priority (docs/technical/10 §4.6).
    const priority = event.trigger === "urgent" ? "high" : "low";
    entries.push({
      resourceType: "Flag",
      id: event.id,
      status: event.phase === "closed" ? "inactive" : "active",
      category: [{ text: `alarm priority ${priority} (IEC 60601-1-8)` }],
      code: { text: `${event.trigger} trigger: ${(trigger?.findings ?? []).join(", ")}` },
      subject: patient,
      encounter,
      period: { start: at(event.openedAt) },
    });
    const answers = log.filter((l) => isStep(l, "answer"));
    if (answers.length > 0) {
      entries.push({
        resourceType: "QuestionnaireResponse",
        id: `${event.id}-answers`,
        questionnaire,
        status: event.phase === "closed" ? "completed" : "in-progress",
        subject: patient,
        encounter,
        item: answers.map((l) => ({
          linkId: l.data.id,
          text: catalog.questions.find((q) => q.id === l.data.id)?.text,
          answer: [{ valueString: l.data.text }],
        })),
      });
    }
    for (const line of log) {
      if (isStep(line, "trigger") || isStep(line, "answer"))
        for (const f of line.data.findings) finding(f, line);
      if (isStep(line, "result")) {
        results(line);
        for (const f of line.data.findings) finding(f, line);
      }
      if (isStep(line, "test")) {
        const done = log.some((l) => isStep(l, "result") && l.data.id === line.data.id);
        entries.push({
          resourceType: "Task",
          id: line.id,
          status: done ? "completed" : "requested",
          intent: "proposal",
          code: { text: catalog.tests.find((t) => t.id === line.data.id)?.name ?? line.data.id },
          for: patient,
          encounter,
          authoredOn: at(line.missionDay),
        });
      }
      if (isStep(line, "action")) {
        const approved = log.some(
          (l) =>
            (isStep(l, "followUp") && l.data.action === line.data.id) ||
            (isStep(l, "escalate") && l.data.action === line.data.id),
        );
        entries.push({
          resourceType: "Task",
          id: line.id,
          status: approved ? "accepted" : "requested",
          intent: "proposal",
          instantiatesUri: `urn:orbivit:pathway:${line.conditionId ?? "unknown"}#${line.data.id}`,
          description: line.data.text,
          for: patient,
          encounter,
          authoredOn: at(line.missionDay),
        });
      }
      if (isStep(line, "escalate")) {
        entries.push({
          resourceType: "Communication",
          id: line.id,
          status: "completed",
          category: [{ text: "escalation to the crew medical officer and the ground" }],
          subject: patient,
          encounter,
          sent: at(line.missionDay),
          payload: [
            { contentString: [line.data.reason, line.data.text].filter(Boolean).join(": ") },
          ],
        });
      }
      if (line.llm) {
        entries.push({
          resourceType: "Provenance",
          id: `${line.id}-provenance`,
          target: [{ identifier: { system: "urn:orbivit:event-log", value: line.id } }],
          recorded: line.timestamp,
          activity: { coding: [{ system: DATA_OPERATION, code: "CREATE" }], text: line.stepType },
          agent: [
            {
              who: {
                display:
                  line.llm.provider === "none"
                    ? `rule-based fallback, rules ${line.ruleVersion}`
                    : `${line.llm.provider} ${line.llm.model ?? ""}, rules ${line.ruleVersion}`,
              },
            },
          ],
        });
      }
    }
    // Suspected diagnoses: never confirmed or refuted by the app (rule 8).
    const assessed = log.findLast((l) => isStep(l, "diagnosis"));
    for (const d of event.diagnoses.filter((x) => x.visible)) {
      const conditionId = "conditionId" in d.ref ? d.ref.conditionId : undefined;
      const condition = catalog.conditions.find((c) => c.id === conditionId);
      const id = `${event.id}-${conditionId ?? "uncatalogued"}`;
      const code = condition
        ? concept(CODE_SYSTEMS.condition, condition.id, condition.name, condition.codes)
        : { text: d.name };
      const evidence = d.evidenceFor.map((e) => ({
        identifier: { system: "urn:orbivit:event-log", value: e },
      }));
      entries.push({
        resourceType: "Condition",
        id,
        ...meta(d.catalogued ? undefined : "UNCATALOGUED"),
        clinicalStatus: {
          coding: [
            { system: CLINICAL_STATUS, code: event.outcome === "resolved" ? "resolved" : "active" },
          ],
        },
        verificationStatus: { coding: [{ system: VER_STATUS, code: d.verificationStatus }] },
        code,
        subject: patient,
        encounter,
        ...(assessed ? { recordedDate: assessed.timestamp } : {}),
        ...(evidence.length > 0 ? { evidence: [{ detail: evidence }] } : {}),
        note: [
          { text: "Suspected – for crew medical officer confirmation. Decision support only." },
        ],
      });
      // The reasoner's confidence; the unranked no-LLM fallback has none to report.
      if (!event.unranked) {
        entries.push({
          resourceType: "RiskAssessment",
          id: `${id}-confidence`,
          status: "final",
          subject: patient,
          encounter,
          condition: { reference: ref("Condition", id) },
          method: { text: "ORBIVIT clinical reasoner (decision support, not validated)" },
          ...(evidence.length > 0 ? { basis: evidence } : {}),
          prediction: [{ outcome: code, probabilityDecimal: d.confidence }],
        });
      }
    }
  }

  return {
    resourceType: "Bundle",
    id: runId,
    ...meta(composite),
    type: "collection",
    timestamp: now.toISOString(),
    entry: entries.map((r) => ({ fullUrl: ref(r.resourceType, r.id), resource: r })),
  };
}
