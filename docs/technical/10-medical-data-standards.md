# 10 — Medical data standards and the measurement interface

This doc lists the standards that apply to the medical data of a spaceflight health monitor, says which of them ORBIVIT adopts, and specifies one standard interface for every medical datum in the app. The decision is ADR 0011. Terms follow [GLOSSARY.md](../../GLOSSARY.md).

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

"Use" says what ORBIVIT does with each standard:
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
| HL7 v2, IHE PCD-01 | Device-to-EHR messages in hospitals | Out of scope | ORBIVIT does not connect to a hospital system. |

### 2.2 Terminologies (what a value means)

| Standard | Covers | Use | License |
|---|---|---|---|
| **LOINC**, https://loinc.org | Codes for observations: vital signs, labs, panels, imaging studies | **Map** every measure | Free, with registration. |
| **SNOMED CT**, https://www.snomed.org | Clinical findings, disorders, qualifiers (`Present`, `Absent`) | **Map** findings and conditions | Free in member countries (for example, the US through the NLM UMLS license). Storing, exchanging and displaying identifiers with their terms is permitted in all jurisdictions, also non-member countries ([SNOMED GPS guide](https://docs.snomed.org/implementation-guides/gps-implementation-guide/technical-application)). So the repo may hold its about 50 codes. The app must not use SNOMED CT hierarchies or subsumption without a license; it does not today. |
| **ICD-10-CM**, https://www.cdc.gov/nchs/icd/icd-10-cm/ | Diagnosis classification for reporting | **Map** conditions, as a cross-reference only | Public domain (US). |
| ICD-11 (WHO) | Current WHO classification | Reference | Better for an international crew. No ICD-11 codes are checked yet *(verify)*. |
| **UCUM**, https://ucum.org | Machine-readable units | **Adopt** for every quantity | Free. |
| **ISO/IEEE 11073-10101** | Device nomenclature (MDC codes) for monitors and wearables | **Map** device-measured vitals | The standard is paid. The codes are listed openly on tx.fhir.org and in the NIST RTMMS. |
| RxNorm, ATC | Medications | Out of scope | ORBIVIT never prescribes medication (ADR 0005). |

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

| Standard | What ORBIVIT takes from it |
|---|---|
| NASA-STD-3001 Vol. 1 Rev. C (crew health) — already `nasa-std-3001-vol1-revc` | Medical care levels, fitness-for-duty and permissible exposure limits. Every limit shown needs its clause *(verify each clause before use)*. |
| NASA-STD-3001 Vol. 2 Rev. F (human factors, habitability, environment), approved 2026-07-14 — `nasa-std-3001-vol2-revf` | Environmental limits. [V2 6004]: the one-hour average ppCO2 in the habitable volume is no more than 3 mmHg. The cabin CO2 rule (`t-cabin-co2`) uses this limit. Rev F supersedes Rev E (2025-05-01). |
| NASA HRP risks and evidence — `nasa-hrp-risks` | The hazard → risk mapping of every catalog condition. |
| NASA OCHMO technical briefs | Plain-language summaries behind the HRP risks. |
| NASA venous thrombosis guidance — `nasa-vte-sp-2025` | The L+30 IJV screening and the vascular contingency kit (Demo 1). |
| ESA HREDA data dictionaries | Variable names and units of European human research data (no open measurements, see 05). |
| ICRP Publication 103; NCRP Report 132 | Radiation quantities: absorbed dose *D* (Gy), dose equivalent *H* (Sv), effective dose *E* (Sv). NASA exposure limits use effective dose. The app must not show a dosimeter reading in mGy next to a limit in mSv without naming both quantities. |

### 2.6 Software, safety and regulation (reference only)

ORBIVIT is a hackathon demo. It claims compliance with none of these. The design follows their main rules where this costs little.

| Standard | Rule the design follows |
|---|---|
| IEC 60601-1-8 (alarm systems) | Alarm priorities: low, medium, high. §4.6 maps the silent watch, the check-in question and the urgent interrupt to these levels. |
| IEC 62304 (software life cycle), ISO 14971 (risk management), IEC 62366-1 (usability) | Traceability: every rule and threshold carries a source and a rule version (already in the event log). |
| FDA guidance on clinical decision support software (final, January 2026) — `fda-cds-2026` | The exclusion from the device definition needs all four criteria of FD&C Act 520(o)(1)(E). **ORBIVIT does not meet Criterion 1:** it analyzes a pattern from a signal acquisition system (the continuous wearable stream). It also alerts the astronaut, not only a health care professional. So a marketed version would be device software. The pitch must not say "non-device CDS" or "FDA-exempt". It may say that the design follows Criterion 4: the crew medical officer can review the basis of each suggestion and decides (ADR 0005). |

## 3. Design rules

Every medical datum that crosses a boundary (data loader → engines → server → UI, event log or export) follows these rules.

1. **Coded.** A datum has a code from a named code system, plus a display text. When no standard code fits, it has a **local code** in an ORBIVIT code system (`urn:orbivit:measure`, `urn:orbivit:finding`, `urn:orbivit:condition`).
2. **Mapped explicitly.** Each local code lists its nearest standard code and the FHIR R4 ConceptMap equivalence (`equivalent`, `wider`, `narrower`, `inexact`, `unmatched`). `unmatched` needs a one-line reason. A mapping never claims more than it is.
3. **UCUM units.** A quantity stores its UCUM code (`/min`, `mm[Hg]`, `10*3/uL`). The UI shows a display unit from the unit registry (`/min` → "bpm"). Unit text from a source file is converted when the data is loaded and never shown raw.
4. **Provenance on the datum.** A datum carries its data label (REAL, SIMULATED, REFERENCE), its `sourceId`, and its origin: stream, anchor, device, operator, astronaut answer, or reasoner. COMPOSITE stays a property of the astronaut (ADR 0009).
5. **Two clocks.** Mission day stays the working time. The export needs a mission epoch and adds an ISO 8601 UTC instant (epoch + mission day). A demo epoch is fictional and labeled SIMULATED.
6. **Typed ranges.** A range has one of four types, and the UI names the type:
   - `lab-reference`: the lab's own range from the source file (FHIR `normal`);
   - `personal-baseline`: the frozen baseline plus its band (ADR 0007);
   - `reference-band`: group data from other astronauts (glossary);
   - `alert-limit`: a design parameter (`illustrative`) until a source exists.
7. **Status is not provenance.** FHIR `status` (`final`, `preliminary`, `amended`, `entered-in-error`) describes the result's life cycle. The data label describes where the value comes from. The two are never merged.
8. **Suspected, never confirmed by the app.** The app writes `Condition.verificationStatus` only as `provisional` (the leading catalogued candidate of a ranked list, after the minimum-evidence rule) or `differential` (every other candidate, and every candidate of an unranked list). Only a crew medical officer action can set `confirmed` or `refuted`.

## 4. The interface

This section describes what M1g built. Where the build differs from the first plan, the text says so.

### 4.1 Core types (`packages/core/src/medical.ts`)

These are a small subset of FHIR R4 in TypeScript. They are not a FHIR server and not a full FHIR library.

```ts
const CODE_SYSTEMS = {
  loinc: "http://loinc.org", snomed: "http://snomed.info/sct",
  icd10cm: "http://hl7.org/fhir/sid/icd-10-cm", mdc: "urn:iso:std:iso:11073:10101",
  ucum: "http://unitsofmeasure.org",
  measure: "urn:orbivit:measure", finding: "urn:orbivit:finding",
  condition: "urn:orbivit:condition",
};

/** One standard code for a local code, and how close it is (FHIR R4 ConceptMap equivalence). */
interface Mapping {
  system: "loinc" | "snomed" | "icd10cm" | "mdc";
  code?: string; display?: string;            // required unless unmatched
  equivalence: "equivalent" | "wider" | "narrower" | "inexact" | "unmatched";
  note?: string;                              // required for unmatched
}

interface MeasureDef {
  id: string; display: string;
  category: "vital-signs" | "laboratory" | "activity" | "exam" | "survey" | "imaging"
          | "procedure" | "environment";
  valueType: "quantity" | "boolean" | "string" | "panel";
  unit?: string;                              // UCUM code from units.yaml
  components?: string[];                      // a panel's measures, for example blood pressure
  signal?: string; metric?: string;           // link to a stream signal or a detection metric
  mappings: Mapping[];
}

/** A logged test value: always a registry measure with its UCUM unit. */
interface ResultValue { measure: string; value: number | boolean | string; unit?: string }

interface Range {
  type: "lab-reference" | "personal-baseline" | "reference-band" | "alert-limit";
  low?: number; high?: number; sourceId: SourceId;
}

/** The single shape of a measurement, for anchors, stream samples, metric values and results. */
interface Measurement {
  id: string; subject: string; measure: string;
  value: number | boolean | string; unit?: string;
  missionDay: MissionDay; context?: SampleContext;
  status: "final" | "preliminary" | "amended" | "entered-in-error";
  ranges?: Range[];
  label: DataLabel; sourceId: SourceId;
  origin: "stream" | "anchor" | "device" | "operator" | "astronaut" | "reasoner";
  deviceId?: string;
}
```

Helpers: `toUcum` (source spelling → UCUM code), `toMeasureId` (alias → measure ID), `displayUnit`, `formatValue`, `codeUrl` (public code page), `mappingProblems`.

The stream signals and detection metrics keep their internal IDs (`hr`, `restingHr`, …). They are not renamed: each one links to its measure through `signal` or `metric` in the registry, and the check requires every link to exist exactly once. This keeps the detection engine and the demo replays unchanged.

### 4.2 Registries (`catalog/`, checked by a script)

Three YAML files hold every code. Code elsewhere refers to them by ID.

- **`catalog/units.yaml`**: the UCUM allowlist (27 codes). Each entry has a UCUM code, a display unit, and the source spellings it replaces (`bpm` → `/min`; `Thousand/uL` → `10*3/uL`; `(calc)` → `1`). Each code was checked once against tx.fhir.org, so the app needs no network (offline rule).
- **`catalog/measures.yaml`**: 52 measures. Each has an ID, display, category, value type, UCUM unit, aliases, and its LOINC and IEEE 11073 mappings with equivalence.
- **`catalog/findings.yaml`**: 54 findings. Each has a display, the SNOMED CT concept with equivalence, and a polarity. An `absent` finding (for example `f-no-fever`) is coded as the concept with the value SNOMED CT 2667000 Absent.

Each condition file has a `codes:` block with one SNOMED CT and one ICD-10-CM mapping.

Anchor units and measure names are converted at load (`normalizeAnchors`). An unknown unit stops the load.

`scripts/check-terminology.ts` (`pnpm check:terminology`, also in CI) runs the catalog check and checks that:
- every unit and alias is unique, and every quantity measure has a unit on the allowlist;
- only a panel lists components, and every component exists;
- every stream signal and detection metric has exactly one measure;
- every test returns registry measures, and its rule and form fields are measures it returns;
- every finding in use is in `findings.yaml`, and no listed finding is unused;
- every coded mapping has a code and a display, and every `unmatched` mapping has a note;
- every condition has a SNOMED CT and an ICD-10-CM mapping;
- every scenario test result, lab and record finding uses registry IDs;
- every code system has a source in `sources.json` (`loinc`, `snomed-ct`, `icd-10-cm`, `ucum`, `ieee-11073-10101`, `hl7-fhir-r4`).

### 4.3 Active tests bound to measures

Each test in `equipment.yaml` lists the measures it `returns`. `ResultRule.field` and `FormField.field` are measure IDs. A form select takes its options from the measure. For example, `t-bp` returns `systolic-bp` and `diastolic-bp` in `mm[Hg]`, not `{ sbp, dbp }`.

`/api/test` keeps its body shape (`{ testId, values }`). It returns 404 for an unknown test and 400 for a value of a measure the test does not return, a value of the wrong type, or a panel given as one value. The log stores each value as a `ResultValue` with the unit taken from the registry. An operator-entered structured finding is exported as `preliminary` until the crew medical officer reviews it.

### 4.4 Check-in questions

The catalog questions are exported as one `Questionnaire`. An item carries the SNOMED CT code of the finding it asks about, when that mapping is `equivalent`. An answer is exported as a `QuestionnaireResponse` item with the astronaut's own text, plus each derived finding as an `Observation` (category `survey`) with the value Present or Absent.

### 4.5 Suspected diagnoses and actions

| App concept | FHIR R4 shape | Fixed rule |
|---|---|---|
| Suspected diagnosis | `Condition`: `code` = the catalog condition plus its `equivalent` and `wider` standard codes; `verificationStatus` = `differential` or `provisional`; `evidence.detail` = event log line IDs | The app never writes `confirmed` or `refuted` (rule 8). Only the leading catalogued diagnosis of a ranked list is `provisional`. The no-LLM fallback does not rank, so all its diagnoses are `differential`. An uncatalogued diagnosis has only `text` and the UNCATALOGUED tag. |
| Confidence | `RiskAssessment` per `Condition`: `prediction.outcome` = the condition concept, `probabilityDecimal` = the confidence | Only for a ranked list. The unranked fallback has no confidence to report. |
| Requested test | `Task`, `intent: proposal`, `status: requested` until a result exists, then `completed` | The test must be on the equipment list. |
| Recommended action | `Task`, `intent: proposal`, `instantiatesUri` = `urn:orbivit:pathway:<condition>#<action>`; `status: requested` until approved, then `accepted` | The action text comes from the catalog only (ADR 0002, ADR 0005). |
| Escalation | `Communication` to the crew medical officer and the ground | — |

The first plan had a `PlanDefinition` per pathway and a confidence extension. The build uses `instantiatesUri` and `RiskAssessment` instead: they are standard elements, and the export needs no custom extension.

### 4.6 Alerts

| App level (glossary) | IEC 60601-1-8 priority | FHIR shape |
|---|---|---|
| Silent watch | none (no alert to the astronaut) | not exported (no event) |
| Check-in question | low | `Flag`, `category` "alarm priority low (IEC 60601-1-8)" |
| Surveillance trigger | low | `Flag`, `category` "alarm priority low (IEC 60601-1-8)" |
| Urgent interrupt | high | `Flag`, `category` "alarm priority high (IEC 60601-1-8)" |

No ORBIVIT level uses the medium priority today. This is explicit, not an omission.

### 4.7 Event log

The JSONL file stays the source of truth. `LogLine` is a discriminated union on `stepType` (`LogData` in `types.ts`), with one typed `data` shape per step. For example, `result` → `{ id; values: ResultValue[]; findings }`, and `diagnosis` entries carry `conditionId` and `verificationStatus`. `isStep(line, "result")` narrows a line, and `dataOf(line, "result")` returns its data or nothing. Each line keeps `label`, `sourceId`, `ruleVersion` and `llm`. `RULE_VERSION` is `m1g-0.1`. The export writes a FHIR `Provenance` for each reasoner step: the agent is the model or the rule-based fallback, and the target is the log line.

### 4.8 Export

`GET /api/fhir/export` returns one FHIR R4 `Bundle` (`type: collection`, `urn:uuid` full URLs) for the current run, as a file download. It contains:
- a `Patient` (the astronaut, tagged COMPOSITE where it applies);
- an `Encounter` for the mission (class `FLD`, field), which starts at the mission epoch;
- the `Device`s from the equipment list;
- the imported labs, the detection metric values and the test results as `Observation`s, each with `effectiveDateTime`;
- the findings as `Observation`s with the value Present or Absent;
- the `Questionnaire`, the `QuestionnaireResponse`s, the `Condition`s, the `RiskAssessment`s, the `Task`s, the `Communication`s, the `Flag`s and the `Provenance`s;
- one `ConceptMap` per local code system and standard target (5 today). These hold every mapping with its equivalence and note, including `unmatched`.

Rules of the export:
- **No custom extensions.** The equivalence is in the ConceptMaps. An Observation or Condition `code` holds the local code plus only its `equivalent` and `wider` standard codes. A `narrower` or `inexact` code appears only in the ConceptMap, so the bundle never claims more than the mapping is.
- **Vital signs profiles.** Heart rate measures carry 8867-4, SpO2 carries 2708-6 (as `wider` mappings), and blood pressure is one `Observation` with the panel code 85354-9 and systolic and diastolic `component`s. The `blood-pressure` measure is a `panel`: its `components` drive this grouping.
- **Two clocks (rule 5).** Each scenario has a fictional `mission.epoch` (2035-01-01T00:00:00Z, SIMULATED). `effectiveDateTime` = epoch + mission day. Without an epoch, the route returns 400.
- **Data labels** go in `meta.tag` (system `urn:orbivit:data-label`).
- **Ranges.** A lab reference range has `type` normal. An alert limit has a local range type, and the text says that it is an illustrative design parameter.

Not exported: the hourly stream samples. The detection metric values carry the same information at the resolution the reasoner uses.

The bundle is a file: it can be saved during a comm blackout and sent later in one transfer.

**Validation (2026-11-15).** The Demo 1 bundle (no-LLM fallback, day 75, 520 KB, 488 resources) was checked with the HL7 validator (validator.fhir.org, FHIR 4.0.1). Result: **0 errors**, 1641 warnings, 1006 information messages. The first run had 550 errors (custom extensions, vital signs profiles, empty arrays). The warnings that remain:
- 446: an Observation has no `performer`. A wearable or device value has no FHIR R4 performer that fits (`Device` is not allowed).
- 978: the local code systems (`urn:orbivit:*`) have no published `CodeSystem`, so the validator cannot check those codes or the ConceptMap sources. The standard codes in the same concept are checked.
- 212: a resource has no narrative (`dom-6`, best practice).
- 2: `spo2` maps to 59408-5 (equivalent) and to 2708-6 (wider), but LOINC does not make 2708-6 a parent of 59408-5. The same applies to `resting-hr` with 40443-4 and 8867-4. The vital signs profiles require the wider codes, so they stay.
- The rest: the validator has no full content for ICD-10-CM and IEEE 11073, and cannot resolve the local Questionnaire URL.

### 4.9 UI

- Every value shows its registry display name and display unit. A code chip (for example "LOINC 40443-4") links to the public code page. A code that is not `equivalent` shows "≈" and says in its tooltip how it differs ("nearest code (broader)"). An `unmatched` mapping shows "no LOINC code", with the reason in the tooltip.
- A range shows its type in words: "lab reference", "personal baseline", "alert limit (illustrative)".
- A suspected diagnosis shows "provisional – for crew medical officer confirmation" or "differential", plus its SNOMED CT and ICD-10-CM codes.
- The event log summarizes each typed line with formatted values and units.
- The replay bar has an "Export FHIR" link to the bundle.
- A dose reading must name its quantity: "absorbed dose, mGy". It never shows a value in mSv that the app has not computed from a sourced method. The current demos show no dose reading.

## 5. Mapping tables (verified 2026-11-15)

### 5.1 Measures

| Local measure | Display | UCUM | LOINC (equivalence) | IEEE 11073 MDC |
|---|---|---|---|---|
| `heart-rate` | Heart rate | `/min` | 8867-4 Heart rate (equivalent) | 147842 MDC_ECG_HEART_RATE; 149530 MDC_PULS_OXIM_PULS_RATE (the one that matches the sensor) |
| `resting-hr` (daily mean, rest windows) | Resting heart rate | `/min` | 40443-4 Heart rate --resting (equivalent); 8867-4 Heart rate (wider, for the vital signs profile) | — |
| `sleeping-hr` (nightly mean, sleep confirmed by activity) | Sleeping heart rate | `/min` | 8867-4 Heart rate (wider). No pre-coordinated sleeping HR code was found. | — |
| `standard-exercise-hr` | HR at the standard workload | `/min` | 8867-4 (wider) | — |
| `max-workload` | Max workload test | `W` | unmatched: no LOINC code was found for peak ergometer workload | — |
| `hrv-sdnn` | HRV (SDNN) | `ms` | 80404-7 R-R interval.standard deviation (Heart rate variability) (equivalent) | — |
| `respiratory-rate` | Respiratory rate | `/min` | 9279-1 (equivalent) | 151562 MDC_RESP_RATE |
| `spo2` | SpO2 | `%` | 59408-5 Oxygen saturation in Arterial blood by Pulse oximetry (equivalent); 2708-6 Oxygen saturation in Arterial blood (wider, for the vital signs profile) | 150456 MDC_PULS_OXIM_SAT_O2 |
| `body-temperature` | Body temperature | `Cel` | 8310-5 (equivalent) | 150364 MDC_TEMP_BODY |
| `skin-temperature` | Skin temperature | `Cel` | 39106-0 Temperature of Skin (equivalent) | — |
| `blood-pressure` (panel: `systolic-bp`, `diastolic-bp`) | Blood pressure | — | 85354-9 Blood pressure panel with all children optional (equivalent) | — |
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

The i-STAT test (`t-istat-chem8`) measures whole blood. Its codes come from the manufacturer's LOINC index (`abbott-istat-loinc`, whole blood): sodium 2947-0, BUN 6299-2 (not 3094-0), creatinine 38483-4, hematocrit 20570-8. Hematocrit stays `inexact`: the LOINC name says "by calculation", but the analyzer measures by conductometry. A fingerstick sample is capillary blood. The index has capillary codes for sodium and hematocrit only, so the app uses the whole-blood codes for all four. The other analytes in the two source files are not shown. They keep their source names until the app uses them.

### 5.3 Findings (sample; the registry covers all 54)

| Finding | SNOMED CT (equivalence) |
|---|---|
| `f-chest-pain` | 29857009 Chest pain (equivalent) |
| `f-syncope` | 271594007 Syncope (equivalent) |
| `f-dyspnea` | 267036007 Dyspnea (equivalent) |
| `f-palpitations` | 80313002 Palpitations (equivalent) |
| `f-dizziness` | 404640003 Dizziness (equivalent) |
| `f-fever` / `f-no-fever` | 386661006 Fever, with Present / Absent |
| `f-fatigue` | 84229001 Fatigue (equivalent) |
| `f-headache-vision` | 25064002 Headache (inexact: the finding also covers a vision change) |
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
| Acute radiation | 1260191006 Acute radiation syndrome (narrower: ARS follows a high whole-body dose; the catalog entry also covers milder effects) | T66 Radiation sickness, unspecified (equivalent) |
| CO2 exposure | 212859008 Toxic effect of carbon dioxide (inexact: the catalog entry covers symptoms below toxic levels) | T59.7X1 Toxic effect of carbon dioxide, accidental (inexact) |
| Sleep loss | 130989002 Sleep deprivation (narrower: the catalog entry also covers circadian misalignment) | Z72.820 Sleep deprivation (narrower, same reason) |
| Behavioral stress | 73595000 Stress (inexact: the catalog entry also covers low mood and poor sleep) | F43.0 Acute stress reaction (inexact) |
| Infection | unmatched: too broad, the catalog entry needs a site | unmatched: same reason |

`unmatched` is an honest result. A spaceflight-specific condition such as deconditioning or SANS has no exact clinical code. The UI shows the HRP risk as the primary reference for it.

## 6. Scope

This is the minimum that makes the interface standard and explicit. It does not turn ORBIVIT into an EHR.

**In:** registries and their check; `Measurement` and the coded types; unit conversion at load; typed test results and log lines; codes, units and range types in the UI; the FHIR `Bundle` export.

**Out:**
- A FHIR server or a FHIR client library.
- Full SNOMED CT or LOINC releases in the repo.
- The HL7 Java validator in CI. One manual validation of the export is enough: it passed with 0 errors (§4.8).
- DICOM, IEEE 11073 device protocols and ICD-11.

## 7. Tasks (milestone M1g)

All six tasks are done. Both demo replays and every existing test stay green.

1. **Registries and check.** Done: `units.yaml`, `measures.yaml`, `findings.yaml`, condition `codes:` blocks, `check:terminology` in CI, six new sources.
2. **Core types.** Done: `medical.ts`, unit conversion at load. Changed from the plan: stream signals and metrics keep their IDs and link to measures (§4.1). `hrv-sdnn` is the measure of the `hrv` signal. Its baseline is now the published in-flight SDNNIDX (§8).
3. **Active tests.** Done: `returns`, rule and form fields bound to measures, `/api/test` validation.
4. **Typed event log.** Done: `LogData` union, `isStep`, `dataOf`, `RULE_VERSION` `m1g-0.1`.
5. **UI.** Done: code chips, display units, range-type words, verification status and codes on suspected diagnoses.
6. **Export.** Done: `GET /api/fhir/export`, the "Export FHIR" link, tests of the Demo 1 bundle (`apps/server/src/fhir.test.ts`), and one HL7 validator run (§4.8).

## 8. Open items

Resolved on 2026-11-15:
- **SNOMED CT license:** identifier use is permitted in all jurisdictions (§2.2, `snomed-gps`).
- **SNOMED CT codes for the four conditions:** §5.4. Each code was checked with `$lookup` (International Edition 2025-02-01). The old candidate 74221003 does not exist.
- **i-STAT whole-blood LOINC codes:** §5.2 (`abbott-istat-loinc`).
- **HRV baselines:** both scenarios use 63 ms. This is the in-flight SDNNIDX on quiet days (mean of 5-minute SDNN over 24 h): 62.9 ± 18.2 ms, ISS01, n = 7 (`otsuka-2019-hrv`, Table 2). The stream's HRV value is a short-window SDNN, so SDNNIDX is the matching quantity, not the 24-hour SDNN (about 170–180 ms). It is a group value, not the astronaut's own. The sleep offset and the noise stay illustrative. Both demos keep their event days.
- **NASA-STD-3001 Vol. 2:** Rev F, [V2 6004] (§2.5). The cabin CO2 rule changed from 4 to 3 mmHg to match it.
- **FDA CDS criteria:** they do not apply (§2.6).

Still open:
- ICD-11 codes *(verify)*.
- Each NASA-STD-3001 Vol. 1 clause before a limit is shown *(verify each clause)*.
