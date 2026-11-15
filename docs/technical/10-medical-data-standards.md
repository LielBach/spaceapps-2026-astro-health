# 10 — Medical data standards and the measurement interface

This doc lists the standards that apply to the medical data of a spaceflight health monitor, says which of them AstroHealth adopts, and specifies one standard interface for every medical datum in the app. The decision is ADR 0011. Terms follow [GLOSSARY.md](../../GLOSSARY.md).

**Status:** plan. Nothing in §4–§6 is built yet. §7 lists the tasks.

**How the codes were checked:** every code in §5 was looked up on 2026-11-15. LOINC, SNOMED CT (international edition), UCUM and ISO/IEEE 11073-10101 codes were checked with `CodeSystem/$lookup` on the HL7 terminology server (tx.fhir.org, FHIR R4). ICD-10-CM codes were checked with the NLM Clinical Tables API. Items marked *(verify)* are not yet confirmed.

## 1. The problem today

The app has medical data in seven places, and each place has its own shape:

| Where | Type today | What is missing |
|---|---|---|
| Real anchors (`Anchor`) | `measure` is a local slug (`hr`, `albumin`, `urea-nitrogen-bun`); `unit` is free text from the source file | No standard code. Units are not machine-readable: `bpm`, `Thousand/uL` and `(calc)` are not valid UCUM. |
| Simulated stream (`Sample`) | `signal` is a local enum (`hr`, `hrv`, `skinTemp`); no unit | Unit is implicit. The quantity behind `hrv` (SDNN? RMSSD?) is not stated. |
| Detection metrics (`MetricId`) | `sleepingHr`, `standardExerciseHr`, `maxWorkload` | Derived measures with no written definition outside the code. |
| Active test results | `Record<string, number \| string \| boolean>` with field names such as `sbp`, `celsius`, `recentDoseMgy` | Untyped. The unit is hidden in the field name. |
| Findings (`f-*`, 52 of them) | Strings inside catalog YAML | No registry, no definition, no clinical code. |
| Conditions (catalog) | Name plus an HRP risk link | No SNOMED CT or ICD code. |
| Event log (`LogLine.data`) | `Record<string, unknown>` | The structure of each step type is implicit. |

The result: a value cannot be read without the app's source code, and nothing can be exchanged with a medical system.

## 2. Standards register

"Use" says what AstroHealth does with each standard:
- **Adopt**: the app's data follows it.
- **Map**: local data carries its codes next to local codes.
- **Reference**: cited for content, such as limits or vocabulary. The data does not follow its format.
- **Out of scope**: considered and not used in the MVP.

### 2.1 Data model and exchange

| Standard | Covers | Use | Why |
|---|---|---|---|
| **HL7 FHIR R4 (4.0.1)**, https://hl7.org/fhir/R4/ | Resource model for health data: `Observation`, `Condition`, `Questionnaire`, `Device`, `Provenance`, `Flag`, `Task`, `PlanDefinition` | **Adopt** the resource shapes as internal types; export as a FHIR `Bundle` | The most widely used exchange model. Its `Condition.verificationStatus` has the values `differential` and `provisional`, which match a suspected diagnosis exactly (ADR 0005). |
| FHIR Vital Signs profile, https://hl7.org/fhir/R4/observation-vitalsigns.html | Required LOINC codes and UCUM units for core vital signs | **Adopt** for HR, RR, SpO2, temperature, BP and body weight | Makes these values readable by any FHIR system. |
| openEHR / ISO 13606 | Archetype-based EHR model | Out of scope | ESA-side programs may use it *(verify)*. FHIR has wider tooling. |
| HL7 v2, IHE PCD-01 | Device-to-EHR messages in hospitals | Out of scope | AstroHealth does not connect to a hospital system. |

### 2.2 Terminologies (what a value means)

| Standard | Covers | Use | License |
|---|---|---|---|
| **LOINC**, https://loinc.org | Codes for observations: vital signs, labs, panels, imaging studies | **Map** every measure | Free, with registration. |
| **SNOMED CT**, https://www.snomed.org | Clinical findings, disorders, qualifiers (`Present`, `Absent`) | **Map** findings and conditions | Free in member countries (for example, the US through the NLM UMLS license). Whether an open-source repo may store about 40 codes needs a check *(verify)*. |
| **ICD-10-CM**, https://www.cdc.gov/nchs/icd/icd-10-cm/ | Diagnosis classification for reporting | **Map** conditions, as a cross-reference only | Public domain (US). |
| ICD-11 (WHO) | Current WHO classification | Reference | Better for an international crew. No ICD-11 codes are checked yet *(verify)*. |
| **UCUM**, https://ucum.org | Machine-readable units | **Adopt** for every quantity | Free. |
| **ISO/IEEE 11073-10101** | Device nomenclature (MDC codes) for monitors and wearables | **Map** device-measured vitals | The standard is paid. The codes are listed openly on tx.fhir.org and in the NIST RTMMS. |
| RxNorm, ATC | Medications | Out of scope | AstroHealth never prescribes medication (ADR 0005). |

### 2.3 Devices, wearables and imaging

| Standard | Covers | Use |
|---|---|---|
| ISO/IEEE 11073-20601 (Personal Health Devices) | Device-to-manager protocol for personal health devices | Reference: live sensors are not in the MVP. |
| IEEE 1752.1-2021 (Open mHealth) | JSON schemas for wearable data: sleep episodes, physical activity, heart rate | Reference: the stream contexts (`sleep`, `rest`, `exercise-*`) follow its idea of a measured value plus a time frame and a context. |
| DICOM | Medical images, including ultrasound | Out of scope: the app shows published scans as JPEG figures and does not read images (ADR 0009). An onboard ultrasound would produce DICOM, which a later version would reference through a FHIR `ImagingStudy`. |

### 2.4 Time, units and space data systems

| Standard | Covers | Use |
|---|---|---|
| ISO 8601 / UTC | Date and time | **Adopt** for every timestamp in the event log and the export. |
| SI (ISO 80000) | Quantities and units | **Adopt** through UCUM. |
| CCSDS 301.0-B (time code formats) | Spacecraft time codes | Reference: mission day is the app's working clock. The export adds an ISO 8601 time. |
| CCSDS 133.0-B (Space Packet Protocol) and CCSDS 734.2-B / RFC 9171 (Bundle Protocol, delay-tolerant networking) | Telemetry and store-and-forward links | Reference: they explain why the app must work offline and why a FHIR `Bundle` is a good unit to send to the ground in one transfer. |

### 2.5 Spaceflight medical standards (content, not format)

These set what to measure and the limits. They do not define a data format.

| Standard | What AstroHealth takes from it |
|---|---|
| NASA-STD-3001 Vol. 1 Rev. C (crew health) — already `nasa-std-3001-vol1-revc` | Medical care levels, fitness-for-duty and permissible exposure limits. Every limit shown needs its clause *(verify each clause before use)*. |
| NASA-STD-3001 Vol. 2 (human factors, habitability, environment) | Environmental limits such as CO2 *(revision and clauses not yet checked: verify)*. |
| NASA HRP risks and evidence — `nasa-hrp-risks` | The hazard → risk mapping of every catalog condition. |
| NASA OCHMO technical briefs | Plain-language summaries behind the HRP risks. |
| NASA venous thrombosis guidance — `nasa-vte-sp-2025` | The L+30 IJV screening and the vascular contingency kit (Demo 1). |
| ESA HREDA data dictionaries | Variable names and units of European human research data (no open measurements, see 05). |
| ICRP Publication 103; NCRP Report 132 | Radiation quantities: absorbed dose *D* (Gy), dose equivalent *H* (Sv), effective dose *E* (Sv). NASA exposure limits use effective dose. The app must not show a dosimeter reading in mGy next to a limit in mSv without naming both quantities. |

### 2.6 Software, safety and regulation (reference only)

AstroHealth is a hackathon demo. It claims compliance with none of these. The design follows their main rules where this costs little.

| Standard | Rule the design follows |
|---|---|
| IEC 60601-1-8 (alarm systems) | Alarm priorities: low, medium, high. §4.6 maps the silent watch, the check-in question and the urgent interrupt to these levels. |
| IEC 62304 (software life cycle), ISO 14971 (risk management), IEC 62366-1 (usability) | Traceability: every rule and threshold carries a source and a rule version (already in the event log). |
| FDA guidance on clinical decision support software (2022) | The user can see the basis of each suggestion, and the clinician decides. This matches ADR 0005 *(verify that the criteria apply before saying so in the pitch)*. |

## 3. Design rules

Every medical datum that crosses a boundary (data loader → engines → server → UI, event log or export) follows these rules.

1. **Coded.** A datum has a code from a named code system, plus a display text. When no standard code fits, it has a **local code** in an AstroHealth code system (`urn:astrohealth:measure`, `urn:astrohealth:finding`, `urn:astrohealth:condition`).
2. **Mapped explicitly.** Each local code lists its nearest standard code and the FHIR R4 ConceptMap equivalence (`equivalent`, `wider`, `narrower`, `inexact`, `unmatched`). `unmatched` needs a one-line reason. A mapping never claims more than it is.
3. **UCUM units.** A quantity stores its UCUM code (`/min`, `mm[Hg]`, `10*3/uL`). The UI shows a display unit from the unit registry (`/min` → "bpm"). Unit text from a source file is converted when the data is loaded and never shown raw.
4. **Provenance on the datum.** A datum carries its data label (REAL, SIMULATED, REFERENCE), its `sourceId`, and its origin: stream, anchor, device, operator, astronaut answer, or reasoner. COMPOSITE stays a property of the astronaut (ADR 0009).
5. **Two clocks.** Mission day stays the working time. When a mission epoch is set, the export adds an ISO 8601 UTC instant. A demo epoch is fictional and labeled SIMULATED.
6. **Typed ranges.** A range has one of four types, and the UI names the type:
   - `lab-reference`: the lab's own range from the source file (FHIR `normal`);
   - `personal-baseline`: the frozen baseline plus its band (ADR 0007);
   - `reference-band`: group data from other astronauts (glossary);
   - `alert-limit`: a design parameter (`illustrative`) until a source exists.
7. **Status is not provenance.** FHIR `status` (`final`, `preliminary`, `amended`, `entered-in-error`) describes the result's life cycle. The data label describes where the value comes from. The two are never merged.
8. **Suspected, never confirmed by the app.** The app writes `Condition.verificationStatus` only as `differential` (any ranked candidate) or `provisional` (the top candidate after the minimum-evidence rule). Only a crew medical officer action can set `confirmed` or `refuted`.

## 4. The interface

### 4.1 Core types (`packages/core/src/medical.ts`)

These are a small subset of FHIR R4 in TypeScript. They are not a FHIR server and not a full FHIR library.

```ts
type CodeSystemUri =
  | "http://loinc.org" | "http://snomed.info/sct" | "http://hl7.org/fhir/sid/icd-10-cm"
  | "urn:iso:std:iso:11073:10101" | "http://unitsofmeasure.org"
  | "urn:astrohealth:measure" | "urn:astrohealth:finding" | "urn:astrohealth:condition";

interface Coding { system: CodeSystemUri; code: string; display: string }

/** The first coding is the primary one. Local codes come first; standard mappings follow. */
interface Concept { coding: Coding[]; text: string }

interface Mapping {
  target: Coding;
  equivalence: "equivalent" | "wider" | "narrower" | "inexact" | "unmatched";
  note?: string;
}

interface Quantity { value: number; unit: UcumCode } // UcumCode: a key of the unit registry

type Origin = "stream" | "anchor" | "device" | "operator" | "astronaut" | "reasoner";

interface Provenance { label: DataLabel; sourceId: SourceId; origin: Origin; deviceId?: string }

interface Range {
  type: "lab-reference" | "personal-baseline" | "reference-band" | "alert-limit";
  low?: Quantity; high?: Quantity;
  sourceId: SourceId;
}

type ObservationCategory = "vital-signs" | "laboratory" | "activity" | "exam" | "survey" | "imaging";

/** One measurement: the single shape for anchors, stream samples, metric values and test results. */
interface Measurement {
  id: string;
  subject: string;                 // astronaut ID
  measure: MeasureId;              // key of the measure registry → code, category, unit
  value: Quantity | boolean | Coding | string;
  missionDay: MissionDay;
  context?: SampleContext;         // sleep, rest, exercise-standard, …
  status: "final" | "preliminary" | "amended" | "entered-in-error";
  ranges?: Range[];
  quality?: number;                // 0–1, stream only
  provenance: Provenance;
}
```

`Sample`, `Anchor` and `LabView` become projections of `Measurement`. The detection engine keeps its fast internal arrays, but everything it emits uses the registry codes.

### 4.2 Registries (`catalog/`, checked by a script)

Three new YAML files hold every code. Code elsewhere refers to them by ID.

- **`catalog/units.yaml`**: the UCUM allowlist. Each entry has a UCUM code, a display unit, and the source spellings it replaces (`bpm` → `/min`; `Thousand/uL` → `10*3/uL`; `(calc)` → `1`). The list is fixed and checked once against tx.fhir.org, so the app needs no network (offline rule).
- **`catalog/measures.yaml`**: one entry per measure. It has a local ID, display, category, UCUM unit, value type, its LOINC and IEEE 11073 mappings with equivalence, and a definition for derived measures (window, context, aggregation). Test result fields and stream signals refer to these IDs.
- **`catalog/findings.yaml`**: one entry per `f-*` finding. It has a display, the SNOMED CT concept with equivalence, and a polarity (`present` / `absent`, coded as SNOMED 52101004 / 2667000).

Condition files get a `codes:` block with SNOMED CT and ICD-10-CM mappings and their equivalence.

`scripts/check-terminology.ts` runs next to `check-sources` in CI. It checks that:
- every measure, finding and unit referenced in the catalog, scenarios, detection config or code exists in a registry;
- every unit is in the UCUM allowlist;
- every standard code has a system and a display;
- every local code has a mapping, or `unmatched` with a reason;
- every mapping has a `sourceId` (new sources: `loinc`, `snomed-ct`, `icd-10-cm`, `ucum`, `ieee-11073-10101`, `hl7-fhir-r4`).

### 4.3 Active tests bound to measures

`ResultRule.field` and `FormField.field` become measure IDs. A test result is a set of `Measurement`s with `origin: "device"` or `"operator"` and `status: "final"`. An operator-entered structured finding stays `preliminary` until the crew medical officer reviews it. For example, `t-bp` returns `systolic-bp` and `diastolic-bp` in `mm[Hg]`, not `{ sbp, dbp }`. `/api/test` keeps its body shape but is validated against the test's measures, with the unit taken from the registry.

### 4.4 Check-in questions

The catalog questions become a FHIR-shaped `Questionnaire`. Each item points to the finding it asks about, and through it to a SNOMED CT concept. An answer is stored as a `QuestionnaireResponse` item with the astronaut's own text, plus the derived findings as `Measurement`s with `category: "survey"` and a present or absent value.

### 4.5 Suspected diagnoses and actions

| App concept | FHIR R4 shape | Fixed rule |
|---|---|---|
| Suspected diagnosis | `Condition`: `code` = catalog condition with its SNOMED CT and ICD-10-CM mappings; `verificationStatus` = `differential` or `provisional`; `evidence.detail` = event log line IDs | The app never writes `confirmed` (rule 8). An uncatalogued diagnosis has only `text`, no code, and the UNCATALOGUED tag. |
| Confidence | Extension `urn:astrohealth:confidence` on the `Condition` | Shown only after the minimum-evidence rule (ADR 0005). |
| Approved pathway | `PlanDefinition` (one per catalog condition): its questions, tests and actions | The reasoner chooses only among its actions (ADR 0002). |
| Requested test | `Task` with `basedOn` the pathway action and `focus` the test | The test must be on the equipment list. |
| Recommended action | `Task` with `status: "requested"` until approved, then `"accepted"` | The action text comes from the catalog only. |
| Escalation | `Communication` to the crew medical officer and the ground | — |

### 4.6 Alerts

| App level (glossary) | IEC 60601-1-8 priority | FHIR shape |
|---|---|---|
| Silent watch | none (no alert to the astronaut) | `Flag`, `status: active`, not shown to the astronaut |
| Check-in question | low | `Flag` plus a check-in `Questionnaire` |
| Surveillance trigger | low | `Flag` with a due day |
| Urgent interrupt | high | `Flag` plus a push |

No AstroHealth level uses the medium priority today. This is explicit, not an omission.

### 4.7 Event log

The JSONL file stays the source of truth. `LogLine.data` becomes a discriminated union with one typed shape per `stepType` (for example, `result` → `{ testId; measurements: Measurement[]; findings: FindingId[] }`). Each line keeps `label`, `sourceId`, `ruleVersion` and `llm`. Together these are a provenance record. The export writes a FHIR `Provenance` for each reasoner step: the agent is the model or "rules", and the entity is the log line.

### 4.8 Export

`GET /api/fhir/export` returns one FHIR R4 `Bundle` (`type: collection`) for the current run. It contains:
- a `Patient` (the astronaut, tagged COMPOSITE where it applies);
- the `Device`s from the equipment list;
- every `Measurement` as an `Observation`;
- the `QuestionnaireResponse`s;
- the `Condition`s, `Task`s, `Flag`s and `Provenance`s.

Data labels go in `meta.tag` (system `urn:astrohealth:data-label`). The bundle is a file: it can be saved during a comm blackout and sent later in one transfer.

### 4.9 UI

- Every value shows its display name and its display unit. A small code chip (for example "LOINC 40443-4") links to the public code page. A local code shows "AstroHealth code" and its mapping.
- A range shows its type in words: "lab reference", "your pre-flight baseline", "other astronauts", "alert limit (illustrative)".
- A suspected diagnosis shows "differential" or "provisional – for crew medical officer confirmation", plus its SNOMED CT and ICD-10-CM codes with equivalence. A `wider` mapping says "nearest code".
- A dose reading names its quantity: "absorbed dose, mGy". It never shows a value in mSv that the app has not computed from a sourced method.

## 5. Mapping tables (verified 2026-11-15)

### 5.1 Measures

| Local measure | Display | UCUM | LOINC (equivalence) | IEEE 11073 MDC |
|---|---|---|---|---|
| `heart-rate` | Heart rate | `/min` | 8867-4 Heart rate (equivalent) | 147842 MDC_ECG_HEART_RATE; 149530 MDC_PULS_OXIM_PULS_RATE (the one that matches the sensor) |
| `resting-hr` (daily mean, rest windows) | Resting heart rate | `/min` | 40443-4 Heart rate --resting (equivalent) | — |
| `sleeping-hr` (nightly mean, sleep confirmed by activity) | Sleeping heart rate | `/min` | 8867-4 Heart rate (wider). No pre-coordinated sleeping HR code was found. | — |
| `standard-exercise-hr` | HR at the standard workload | `/min` | 8867-4 (wider) | — |
| `max-workload` | Max workload test | `W` | unmatched: no LOINC code was found for peak ergometer workload | — |
| `hrv-sdnn` | HRV (SDNN) | `ms` | 80404-7 R-R interval.standard deviation (Heart rate variability) (equivalent) | — |
| `respiratory-rate` | Respiratory rate | `/min` | 9279-1 (equivalent) | 151562 MDC_RESP_RATE |
| `spo2` | SpO2 | `%` | 59408-5 Oxygen saturation in Arterial blood by Pulse oximetry (equivalent) | 150456 MDC_PULS_OXIM_SAT_O2 |
| `body-temperature` | Body temperature | `Cel` | 8310-5 (equivalent) | 150364 MDC_TEMP_BODY |
| `skin-temperature` | Skin temperature | `Cel` | 39106-0 Temperature of Skin (equivalent) | — |
| `bp-panel` | Blood pressure | — | 85354-9 Blood pressure panel (equivalent) | — |
| `systolic-bp` | Systolic BP | `mm[Hg]` | 8480-6 (equivalent) | 150021 MDC_PRESS_BLD_NONINV_SYS |
| `diastolic-bp` | Diastolic BP | `mm[Hg]` | 8462-4 (equivalent) | 150022 MDC_PRESS_BLD_NONINV_DIA |
| `mean-bp` | Mean arterial pressure | `mm[Hg]` | 8478-0 (equivalent) | 150023 MDC_PRESS_BLD_NONINV_MEAN |
| `body-mass` | Body mass | `kg` | 29463-7 Body weight (equivalent) | 188736 MDC_MASS_BODY_ACTUAL |
| `body-mass-change` | Body mass change | `kg` | unmatched: derived from two `body-mass` values | — |
| `stroke-volume` (NLSP 178066) | Stroke volume | `mL` | 20562-5 Left ventricular Stroke volume (equivalent) | — |
| `cardiac-output` (NLSP 178066) | Cardiac output | `L/min` | 8741-1 Left ventricular Cardiac output (equivalent) | — |
| `urine-color` | Urine color | `{score}` | 5778-6 Color of Urine (inexact: the app uses a numbered color chart, LOINC is the color itself) | — |
| `ecg` | 12-lead ECG | — | 11524-6 EKG study; result 8601-7 EKG impression | — |
| `ijv-ultrasound` | IJV Doppler ultrasound | — | 44175-8 US.doppler Neck vessels (wider) | — |
| `ijv-flow-grade` | IJV flow grade 1–4 | `{grade}` | unmatched: the Marshall-Goebel 2019 scale has no LOINC code | — |
| `absorbed-dose-recent` | Recent absorbed dose | `mGy` | unmatched: LOINC 77304-4 Radiation dose [Energy/mass] is a therapy dose, not crew dosimetry | — |
| `steps` | Steps in 24 h | `{steps}` | 41950-7 Number of steps in 24 hour Measured (equivalent) | — |
| `sleep-duration` | Sleep duration | `h` | 93832-4 Sleep duration (equivalent) | — |

### 5.2 Labs (Inspiration4, OSD-575 and OSD-569)

| Local measure | LOINC | Source unit → UCUM |
|---|---|---|
| `albumin` | 1751-7 Albumin [Mass/volume] in Serum or Plasma | g/dL → `g/dL` |
| `protein-total` | 2885-2 Protein [Mass/volume] in Serum or Plasma | g/dL → `g/dL` |
| `hemoglobin` | 718-7 Hemoglobin [Mass/volume] in Blood | g/dL → `g/dL` |
| `hematocrit` | 4544-3 Hematocrit [Volume Fraction] of Blood by Automated count | % → `%` |
| `platelet-count` | 777-3 Platelets [#/volume] in Blood by Automated count | Thousand/uL → `10*3/uL` |
| `white-blood-cell-count` | 6690-2 Leukocytes [#/volume] in Blood by Automated count | Thousand/uL → `10*3/uL` |
| `sodium` | 2951-2 Sodium [Moles/volume] in Serum or Plasma | mmol/L → `mmol/L` |
| `potassium` | 2823-3 Potassium [Moles/volume] in Serum or Plasma | mmol/L → `mmol/L` |
| `urea-nitrogen-bun` | 3094-0 Urea nitrogen [Mass/volume] in Serum or Plasma | mg/dL → `mg/dL` |
| `creatinine` | 2160-0 Creatinine [Mass/volume] in Serum or Plasma | mg/dL → `mg/dL` |

The i-STAT test (`t-istat-chem8`) measures whole blood. Its BUN uses 6299-2 Urea nitrogen [Mass/volume] in Blood, not 3094-0. The other i-STAT codes need the same check *(verify)*. The other analytes in the two source files are not shown. They keep their source names until the app uses them.

### 5.3 Findings (sample; the registry covers all 52)

| Finding | SNOMED CT (equivalence) |
|---|---|
| `f-chest-pain` | 29857009 Chest pain (equivalent) |
| `f-syncope` | 271594007 Syncope (equivalent) |
| `f-dyspnea` | 267036007 Dyspnea (equivalent) |
| `f-palpitations` | 80313002 Palpitations (equivalent) |
| `f-dizziness` | 404640003 Dizziness (equivalent) |
| `f-fever` / `f-no-fever` | 386661006 Fever, with Present / Absent |
| `f-fatigue` | 84229001 Fatigue (equivalent) |
| `f-headache-vision` | 25064002 Headache (wider: the finding also covers vision change) |
| `f-resting-hr-high`, `f-exercise-hr-up`, … | unmatched: a deviation from the personal baseline. Its definition is the measure plus the detection rule. |

### 5.4 Conditions

| Catalog condition | SNOMED CT (equivalence) | ICD-10-CM (equivalence) |
|---|---|---|
| IJV thrombosis | 128053003 Deep venous thrombosis (wider) | I82.C1- Acute embolism and thrombosis of internal jugular vein (narrower: acute only; laterality is coded at confirmation, for example I82.C12 left) |
| Cardiovascular deconditioning | unmatched: no concept found | unmatched: R53.81 "Other malaise" is not an equivalent |
| Reduced fluid volume | 34095006 Dehydration (inexact) | E86.9 Volume depletion, unspecified (inexact) |
| Anemia | 271737000 Anemia (equivalent) | D64.9 Anemia, unspecified (equivalent) |
| Arrhythmia | 698247007 Cardiac arrhythmia (equivalent) | I49.9 Cardiac arrhythmia, unspecified (equivalent) |
| Renal stone | 95570007 Kidney stone (equivalent) | N20.0 Calculus of kidney (equivalent) |
| SANS | 423341008 Optic disc edema (narrower: one sign of SANS) | H47.10 Unspecified papilledema (inexact: SANS is not papilledema) |
| Acute radiation | *(verify: 74221003 was not found)* | T66 Radiation sickness, unspecified (equivalent) |
| CO2 exposure | *(verify)* | T59.7X1 Toxic effect of carbon dioxide, accidental (inexact) |
| Sleep loss | *(verify)* | Z72.820 Sleep deprivation (equivalent) |
| Behavioral stress | *(verify)* | F43.0 Acute stress reaction (inexact) |
| Infection | — (too broad: the catalog entry needs a site) | — |

`unmatched` is an honest result. A spaceflight-specific condition such as deconditioning or SANS has no exact clinical code. The UI shows the HRP risk as the primary reference for it.

## 6. Scope

This is the minimum that makes the interface standard and explicit. It does not turn AstroHealth into an EHR.

**In:** registries and their check; `Measurement` and the coded types; unit conversion at load; typed test results and log lines; codes, units and range types in the UI; the FHIR `Bundle` export.

**Out:**
- A FHIR server or a FHIR client library.
- Full SNOMED CT or LOINC releases in the repo.
- The HL7 Java validator in CI. One manual validation of the export is enough *(verify that it passes)*.
- DICOM, IEEE 11073 device protocols and ICD-11.

## 7. Tasks (milestone M1g)

Each task keeps both demo replays and every existing test green.

1. **Registries and check.** Add `units.yaml`, `measures.yaml`, `findings.yaml` and condition `codes:` blocks with the §5 tables. Add `check-terminology` to CI and the six new sources to `sources.json`.
2. **Core types.** Add `medical.ts`. Convert anchor units at load (`bpm` → `/min`, `Thousand/uL` → `10*3/uL`). Rename stream signals and metrics to registry measure IDs. `hrv` becomes `hrv-sdnn`: the stream's HRV values are illustrative today (`sourceId: illustrative`), so this choice also sets which published values must replace them.
3. **Active tests.** Bind `ResultRule.field` and `FormField.field` to measures, and validate `/api/test` against them.
4. **Typed event log.** Make `LogLine.data` a discriminated union, and bump `RULE_VERSION`.
5. **UI.** Add code chips, display units, range-type words, verification status and codes on suspected diagnoses, and the dose quantity name.
6. **Export.** Add `GET /api/fhir/export` and an export button. Add a golden-file test of one Demo 1 bundle.

Tasks 1–2 come first. Tasks 3–5 can then run in parallel. Task 6 comes last.

## 8. Open items

- SNOMED CT license terms for codes stored in a public repo *(verify)*.
- SNOMED CT codes for acute radiation syndrome, CO2 toxicity, sleep deprivation and acute stress *(verify)*.
- The i-STAT whole-blood LOINC codes *(verify)*.
- Published SDNN values to replace the illustrative HRV baselines *(verify)*.
- NASA-STD-3001 Vol. 2 revision and clauses *(verify)*.
- Whether the FDA CDS criteria apply, before the pitch says so *(verify)*.
