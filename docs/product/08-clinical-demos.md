# 08 — Clinical demo workflows

> **Status:** aligned with [GLOSSARY.md](../../GLOSSARY.md) and ADRs 0001–0009 in [docs/adr/](../adr/). We build both demos (ADR 0008), Demo 2 first. Every value on screen is labeled **REAL**, **SIMULATED** or **REFERENCE**; Maya in Demo 1 is also marked **COMPOSITE** (ADR 0009).


**Project:** Proactive, autonomous clinical decision support for exploration missions  
**Document purpose:** English-language, step-by-step narrative and implementation specification for two project demos  
**Version:** 1.0 | November 2026  
**Status:** Concept demonstration; not validated medical software or an operational NASA protocol

> **Core concept:** AstroHealth turns monitored physiological changes and individual medical risk into proactive assessment through the closed loop **detect → investigate → assess → act → learn**. Investigate holds verify, alert, ask and test; act holds monitor.

## How to interpret these demos

The health hazards and selected medical findings described below have a scientific foundation. Each demo astronaut is anchored to real open NASA data (ADR 0003): **REAL** values are measured values of that astronaut; **SIMULATED** values fill the long mission; **REFERENCE** values are group data from other real astronauts. Dates, notifications, diagnostic sequences and outcomes are **fictional**. All thresholds, triage triggers, and recommended interventions require review against approved spaceflight medical protocols before clinical use. NASA's publicly reported internal jugular thrombosis case provides historical motivation for Demo 1; neither that astronaut's exact prior physiological data nor the onset of the clot is known from public reporting.

**Sensor feasibility:** An onboard wearable can capture heart rate and, if specifically equipped and worn appropriately, continuous ECG; exercise devices can capture workout performance. Not every astronaut today wears a continuous ECG device 24 hours a day. A wearable cannot directly diagnose jugular vein thrombosis. Duplex ultrasound is the appropriate targeted imaging test when a validated clinical pathway indicates it. Medical data flows and diagnostic devices below are proposed integrations for a Mars spacecraft.

**Safety rule:** If severe symptoms or unstable vital signs are present, AstroHealth bypasses the ordinary conversational workflow and activates the approved emergency response. The system supports—not replaces—qualified medical decision-making. It never autonomously prescribes anticoagulation or antiarrhythmic medication.

---

# Demo 1 — Earlier Detection of Potentially Dangerous Venous Thrombosis

**NASA human-spaceflight hazard:** Altered Gravity Fields  
**Clinical issue:** Internal jugular vein (IJV) flow stasis and venous thromboembolism (VTE)  
**Demo focus:** Longitudinal risk-aware surveillance and earlier diagnostic imaging, **not** direct clot detection by a wearable.

## 1. Why this case matters

An astronaut on the International Space Station was found to have an **asymptomatic internal jugular vein thrombosis** during a research ultrasound roughly 50 days into the flight. It became a widely discussed example of a previously underappreciated spaceflight medical risk. Changes in venous flow during microgravity can include stasis or abnormal flow patterns. Because there may be few or no symptoms, reliance on symptom-triggered care alone is inadequate.

The real case **does not establish** that heart rate, ECG, or other continuously wearable signals were abnormal before the clot formed. A later publication discussed low albumin and hormonal contraceptive exposure, but the available public information does not establish that these findings predicted the timing of thrombosis. NASA has subsequently developed spaceflight venous screening and risk-assessment guidance. The demonstration therefore models a **prospective, risk-adaptive workflow**, not a reconstruction of what AstroHealth would definitely have found in 2019.

## 2. Fictional astronaut and starting conditions

**Astronaut:** Maya, Mars transit day 24. **COMPOSITE** of two real astronauts (ADR 0009): pre-flight labs from one Inspiration4 crew member (OSD-575, OSD-569; the subject with the lowest pre-flight albumin), ultrasound scans from an ISS crew member (Marshall-Goebel 2019, CC-BY). The demo never claims these belong to one person.  
**Symptoms:** Feels normal; no reported chest pain, shortness of breath, neck swelling, or neurological symptoms.  
**Existing record:** **REAL** pre-flight labs (CMP including albumin, CBC). **SIMULATED:** an earlier scheduled in-flight ultrasound documented reduced flow in the left IJV (flow grade 3, stagnant), without an identified thrombus; seeded from the group counts in Marshall-Goebel 2019 (stagnant flow in 5 of 11 crew on flight day 50).  
**Wearable trend (SIMULATED, illustrative):** Sleeping heart rate has drifted from an example baseline of **62 bpm** to **76–88 bpm** across several nights.

**Interpretation caution:** Rising heart rate is **nonspecific**. It could reflect sleep disruption, dehydration, illness, exercise adaptation, medications, or other causes; a localized IJV clot may produce no wearable signal at all. The **prior abnormal venous imaging** and medically assessed VTE risk—not the heart-rate change by itself—are what could justify a targeted vascular reassessment.

## 3. Full workflow, step by step

### Step 1 — Import and preserve the longitudinal health record

- **Inputs:** Preflight risk history, medications, prior ultrasound findings, previous vital-sign baselines, mission day and microgravity exposure.
- **System:** Normalizes measurements, checks provenance, time stamps and data availability; retains the original images/reports and their interpretation status.
- **Clinical logic:** An existing abnormal venous flow finding sets a **surveillance trigger**: the approved pathway schedules a vascular reassessment, with or without any passive-signal change.
- **Demo screen:** `Astronaut profile > Vascular history > Prior IJV flow abnormality`.
- **Record stored:** Source study, finding, date, clinician review, risk factors, protocol version.

### Step 2 — Identify a new physiological change

- **Input:** Multi-night rise in sleeping heart rate (a passive signal), with activity and sleep context.
- **System:** Checks signal quality, resting-state validity, wear time, recent exercise and persistence over repeated measurements.
- **Clinical logic:** Opens a **general physiological assessment** for sustained unexplained change; it does **not** output “clot detected.”
- **Demo screen:** `Unexpected longitudinal HR trend — assessment suggested`.
- **Record stored:** Signal summary, quality flags, baseline method, time window and alert rationale.

### Step 3 — Initiate an astronaut-facing assessment

**Example check-in question** (shown inside the daily check-in, not as a push; only an urgent interrupt pushes):

> “AstroHealth has identified a sustained change from your usual resting heart-rate pattern. Please complete a brief health assessment. Your record also contains a previous vascular-flow finding that may require follow-up under the mission medical protocol.”

- **System:** Provides an accessible acknowledgment mechanism and prioritizes symptoms indicating emergencies.
- **Astronaut:** Opens the tablet or wearable interface.
- **Record stored:** Alert delivery, response time and acknowledgment.

### Step 4 — Ask adaptive symptom and risk questions

**First questions (urgent red flags):**

1. Are you experiencing new or sudden shortness of breath?
2. Do you have chest pain, fainting, or severe dizziness?
3. Have you noticed new severe headache, visual symptoms, facial/neck swelling, or neck discomfort?

**Contextual follow-up if stable:**

4. Recent fever, respiratory symptoms, decreased fluid intake or unusual workload?
5. Any medication changes or new risk exposures?
6. Any similar previous episodes or known clotting disorders?

- **System:** Selects from an approved question set, remembers answers already supplied and records unanswered items.
- **Fictional result:** All key symptom questions negative; the astronaut remains stable.
- **Safety:** Acute chest pain, unexplained breathlessness, syncope or instability bypasses routine follow-up and triggers emergency evaluation for causes including pulmonary embolism.

### Step 5 — Request readily available additional measurements

- **Requested:** Repeat resting HR, blood pressure, temperature and SpO₂; ECG if the findings support it.
- **Purpose:** Investigate the new physiological change and identify immediate instability or alternative causes.
- **System:** Imports readings automatically where supported or records a verified manual entry.
- **Important limitation:** **Normal BP, SpO₂ or ECG does not rule out IJV thrombosis.**
- **Record stored:** Raw values, device metadata, time stamps, quality, and any user-entered values.

### Step 6 — Perform risk-adaptive clinical reasoning

The decision engine explicitly separates two clinical questions:

**A. Why has the resting heart rate increased?** Consider nonspecific causes such as sleep deprivation, inadequate hydration, intercurrent illness, exercise adaptation or rhythm problems. Investigate according to validated pathways.

**B. Does the astronaut's prior venous-flow abnormality and overall VTE risk warrant earlier targeted ultrasound?** This is the **surveillance trigger** from step 1. Apply an approved spaceflight-specific risk and surveillance protocol. The algorithm must be able to schedule the ultrasound **even if the HR trend is absent**, if the historical vascular finding independently warrants it.

- **Demo output:** `Risk-adaptive IJV ultrasound assessment indicated for clinician/protocol review`.
- **Uncertainty:** No clot has yet been diagnosed.
- **Record stored:** Rule that fired, inputs, alternatives considered, oversight required.

### Step 7 — Guide targeted vascular imaging

- **System:** Provides the approved preparation and acquisition checklist for a trained crew member; integrates with the onboard ultrasound workflow if available.
- **Test:** Targeted IJV duplex ultrasound evaluating venous patency, flow and compressibility as appropriate for the protocol.
- **Input to AstroHealth:** the operator enters a **structured finding**: Doppler flow detected yes/no, flow grade 1–4 (Marshall-Goebel 2019, Figure 3A: continuous, pulsatile, stagnant, retrograde), compressibility, thrombus seen yes/no. AstroHealth does not interpret images.
- **Images shown:** real NASA scans, labeled **REAL – ISS crew member, Marshall-Goebel 2019, CC-BY** (COMPOSITE, ADR 0009): Figure 3B (pre-flight, grade 2) as Maya's earlier scan, Figure 3C (ISS flight day 50, thrombus) as today's scan.
- **Scripted result:** structured finding of no detectable flow and a thrombus in the left internal jugular vein.
- **Safety:** Automated image interpretation cannot be treated as definitive without an appropriately validated workflow and qualified review.
- **Record stored:** Images, scan protocol, operator, observations, interpretation status.

### Step 8 — Issue a clinically bounded assessment and escalation

**Example AstroHealth report:**

> **Urgent vascular finding — suspected IJV thrombosis.** Targeted ultrasound suggests thrombus in the left internal jugular vein. The astronaut currently reports no symptoms. Initiate the mission-approved thrombosis evaluation pathway and obtain qualified review or use preauthorized autonomous procedures when Earth communication is unavailable.

- **System:** Highlights whether the diagnosis is *suspected* or *confirmed*, what evidence is missing, and what complications require immediate attention.
- **Treatment:** Anticoagulation decisions require authorized medical oversight and assessment of clot characteristics, bleeding risk and available medications; the chatbot does not independently prescribe.
- **Record stored:** Differential, urgency, review and action status.

### Step 9 — Longitudinal follow-up

- **System:** Tracks scheduled repeat ultrasound, symptoms, clinical stability, treatment decisions and changes in imaging findings.
- **Action:** Escalates missed follow-ups, new emergency symptoms or concerning trends under approved rules.
- **Record stored:** Outcome time series, interventions and versioned clinical notes.

### Step 10 — Research and future prevention

> **Architecture slide only, not in the MVP.** The event log is the future data source for this layer.

- **Research data:** Pseudonymized/appropriately governed longitudinal venous findings, demographics or relevant physiological characteristics, exposures, timing, clinical decisions and outcomes.
- **Potential research question:** Do particular combinations of preflight characteristics and evolving venous-flow abnormalities identify astronauts who benefit from earlier screening?
- **Limitations:** Small astronaut cohorts, selection bias, time-varying risk and incomplete labels mean that predictive performance must be tested prospectively. An observed association is not proof that an intervention prevents thrombosis.

## 4. What the demo proves—and what it does not

**Demonstrates:** Integration of historical data, a new wearable trend, targeted questioning, additional clinical tests, protocol-guided ultrasound, escalation, and documented follow-up.

**Does not prove:** That wearable HR detects silent IJV clots, that a low albumin value independently predicts VTE, that this system would have prevented the real 2019 event, or that earlier ultrasound always improves outcomes.

**Suggested pitch line:**

> “When symptoms are absent, risk-aware monitoring can still prompt the right medical investigation—before the next routine examination.”

---

# Demo 2 — Early Intervention for Cardiovascular Deconditioning

**NASA human-spaceflight hazard:** Altered Gravity Fields  
**Clinical issue:** Progressive cardiovascular deconditioning with potential orthostatic intolerance on gravitational transition  
**Demo focus:** A **more common, longitudinal, measurable and actionable** spaceflight problem, using data already obtainable from wearables and exercise equipment.

## 1. Why this case matters

Prolonged microgravity alters cardiovascular regulation and reduces the normal gravitational demands on circulation. Astronauts also experience changes in exercise capacity and physical conditioning. Some astronauts demonstrate reduced aerobic capacity despite countermeasure exercise, and orthostatic intolerance can become clinically significant during return to gravity or transition to a planetary surface.

This is well suited to AstroHealth because the relevant patterns may evolve over **days to weeks**, allowing proactive assessment of declines in exercise tolerance, heart-rate response, recovery, and other physiologic measures. Exercise countermeasures and clinical follow-up already exist; the software could help determine when performance trends merit investigation or review of the countermeasure plan.

## 2. Fictional astronaut and baseline

**Astronaut:** Alex, Mars transit day 120. Alex is subject 1 of the real Shuttle study NLSP 178066 (STS-40/58, Shykoff 1996; which flight is *(verify)*).  
**Symptoms:** No major symptoms during routine activity; reports feeling broadly well.  
**Sensors:** Wearable HR and activity monitoring, exercise-device workload and duration records, and intermittent blood-pressure measurements.  
**REAL (Alex's measured values):**

| | Heart rate | BP | Cardiac output | Stroke volume |
|---|---|---|---|---|
| Before flight, upright | 80 | 112/87 | 5.7 L/min | 73 ml |
| Before flight, lying down | 69 | 113/82 | 8.4 L/min | 121 ml |
| During flight (one average, 9–14-day flight) | 66 | 127/74 | 7.8 L/min | 117 ml |

**SIMULATED:** everything after the real in-flight value. **Individual exercise baseline:** HR **125 bpm** during a standardized cycling workload, seeded from Alex's real resting HR and the real STS-40 group slope of HR against workload in flight.  
**New trend (SIMULATED):** HR **143 bpm** at the **same workload** across repeated comparable sessions. Standardized exercise performance is down **18%** from the astronaut's prior reference performance.

The values are **illustrative only**. They are not a validated diagnostic cutoff; the measurements must be comparable in exercise modality, workload, environmental conditions, sensor quality, medication use and recovery state.

## 3. Full workflow, step by step

### Step 1 — Continuously collect routine physiological and performance data

- **Inputs:** passive signals: HR, activity, resting trends, and the exercise device's records of workload and duration; plus perceived exertion (if recorded), sleep and available environmental context.
- **System:** Associates each HR measurement with activity intensity and the relevant exercise session.
- **Demo screen:** Longitudinal dashboard showing matched-workload HR and performance over time.
- **Record stored:** Raw observations, comparable exercise protocol, device details and baseline definitions.

### Step 2 — Detect a meaningful longitudinal deviation

- **System:** Finds repeated increases in HR at the same standardized workload and a concurrent decline in achieved performance.
- **Validation:** Confirms that exercise duration, workload, calibration and sensor quality are comparable; checks for isolated outliers.
- **Clinical logic:** Flags `Possible decline in cardiovascular exercise tolerance — requires assessment`.
- **Interpretation:** Deconditioning is a hypothesis, **not** an automatic diagnosis.

### Step 3 — Proactively contact the astronaut

**Example check-in question** (inside the daily check-in, not a push: this is a trend over weeks, not an emergency):

> “Your cardiovascular response to a standard exercise workload has changed over several sessions. You may not notice symptoms yet, but the pattern merits a short medical assessment.”

- **Astronaut:** Sees the question in the next daily check-in on the ship's tablet.
- **System:** Prioritizes symptoms or readings that would necessitate urgent escalation.
- **Record stored:** Alert generation, acknowledgment and context.

### Step 4 — Ask targeted clinical questions

**Safety questions:**

1. Any chest pain, fainting, severe dizziness, breathlessness or palpitations?
2. Any symptoms during exercise or immediately afterward?

**Contextual questions:**

3. Increased fatigue, reduced tolerance for ordinary activity, or difficulty completing workouts?
4. Recent poor sleep, infection symptoms, dehydration or low fluid intake?
5. Changes in medication, caffeine intake, workload, stress or exercise equipment settings?
6. Do you feel dizzy or light-headed during transitions or prescribed functional tests?

- **Fictional result:** No red-flag symptoms; mild new fatigue after exercise and reduced fluid intake are reported.
- **System:** Uses the responses to select the next approved investigations.

### Step 5 — Request targeted confirmatory measurements

**Initial tests:**

- Repeat HR recording at rest and during a **standardized, safe** exercise assessment.
- Obtain BP and SpO₂ at rest and as clinically indicated.
- Review weight/body-mass trends, fluid balance and sleep/activity records when available.
- Obtain ECG if an unexpected rhythm, symptoms, or protocol triggers indicate it.

**Additional tests if indicated and available:**

- Directed cardiovascular ultrasound or other mission-approved cardiovascular assessment.
- Selected point-of-care tests (e.g. CBC/electrolytes) if clinical history and equipment justify them.

**Important:** Earth-style standing or head-up tilt tests cannot simply be reproduced in transit microgravity. Orthostatic tolerance must be assessed using an appropriate, validated gravitational-transition or analog protocol, and should not be improvised by an AI chatbot.

### Step 6 — Integrate findings into a differential assessment

Possible explanations include:

- Cardiovascular deconditioning associated with prolonged microgravity.
- Hypovolemia or inadequate fluid intake.
- Recent illness, sleep disruption or reduced training adherence.
- Anemia, rhythm disturbance or other clinical conditions when supported by measurements.
- Measurement artifact or non-equivalent exercise comparisons.

**Fictional result:** Repeat testing confirms an increased HR response at standardized workload, while emergency red flags are absent. No arrhythmia is identified on any ECG obtained. The system reports **suspected reduced exercise tolerance consistent with possible deconditioning**, with hydration and other contributors still needing clinical evaluation.

**Output:** A ranked, explainable assessment with confidence limitations, not a definitive diagnosis based on wearable data alone.

### Step 7 — Recommend an approved and actionable countermeasure review

- **System:** Suggests review of the current exercise countermeasure schedule and cardiovascular performance by the mission's medical/exercise specialist or approved autonomous protocol.
- **Potential actions:** Confirm exercise-device settings and adherence, assess hydration/nutrition, consider medically authorized adjustments to aerobic/resistive training, and schedule follow-up testing.
- **Safety:** Do not autonomously intensify exercise if symptoms or concerning clinical findings suggest a contraindication; do not prescribe specific fluid or medication regimens without an authorized protocol.
- **Record stored:** Proposed action, reason, responsible reviewer, authorization and actual intervention.

### Step 8 — Verify whether the intervention helps

- **System:** Repeats matched-workload exercise comparisons, resting physiological trends and symptom checks over clinically approved intervals.
- **Fictional follow-up:** HR response trends back toward the prior range and performance improves after review and adjustment of countermeasures.
- **Alternative branch:** If the decline persists or new symptoms appear, the system reopens the differential and escalates for additional testing.
- **Record stored:** Pre/post intervention trends, outcomes, adherence and adverse effects.

### Step 9 — Prepare for gravity transition

- **System:** Summarizes the astronaut's cardiovascular response to microgravity and flags unresolved functional or hemodynamic concerns for the mission medical team before Mars landing or other gravitational transition.
- **REFERENCE band:** post-flight supine and standing HR and BP of 26 real Shuttle astronauts (DSO 402, NLSP), shown as the range that astronauts usually reach after flight, never as Alex's values.
- **Possible goal:** Better-planned pre-landing countermeasures and targeted evaluation of astronauts who may have impaired functional tolerance.
- **Caution:** The demo does **not** prove that wearable changes predict individual syncope or orthostatic intolerance; this would require validated longitudinal outcome models.

### Step 10 — Longitudinal research and preventive learning

> **Architecture slide only, not in the MVP.** The event log is the future data source for this layer.

- **Research data:** Similarities in preflight fitness, changes in matched-workload HR, training exposure, clinical assessments, countermeasure changes and outcomes.
- **Potential research question:** Which physiological trajectories precede clinically significant loss of performance or poor tolerance to gravitational transitions, and which interventions improve these trajectories?
- **Future potential:** More individualized countermeasure plans, subject to adequate cohort sizes and external validation.

## 4. What the demo proves—and what it does not

**Demonstrates:** Direct value from routine wearable/exercise data; repeated trend detection; targeted questions and tests; clinical evaluation; intervention review; objective follow-up; and learning from each astronaut's longitudinal record.

**Does not prove:** That a higher exercise HR uniquely diagnoses deconditioning, that all astronauts experience the same adaptation, or that the software can already predict orthostatic collapse or guarantee prevention.

**Suggested pitch line:**

> “Before a performance decline becomes a mission-threatening limitation, AstroHealth identifies the trajectory, initiates assessment, and helps adapt the care plan.”

---

# Comparison and Presentation Guidance

| Attribute | Demo 1: Thrombosis | Demo 2: Cardiovascular Deconditioning |
|---|---|---|
| Spaceflight hazard | Altered gravity / venous stasis | Altered gravity / cardiovascular adaptation |
| Main trigger | Prior abnormal venous flow and validated risk-based surveillance; HR trend may initiate a separate general assessment | Repeated abnormal heart-rate response to matched workload plus performance decline |
| Direct detection by wearable? | **No** — cannot diagnose a jugular clot | Detects physiological performance changes, not the diagnosis itself |
| Key additional examination | Targeted IJV duplex ultrasound | Standardized exercise and cardiovascular testing; BP, ECG/labs when indicated |
| Potential medical impact | Earlier evaluation of a potentially serious, silent condition | Earlier response to a relatively common, clinically actionable deterioration |
| Longitudinal value | Individualized vascular surveillance and future VTE research | Individualized countermeasures and tracking response to intervention |
| Main limitation | No validated wearable precursor to silent IJV thrombosis | Nonspecific sensor signals and uncertain individual outcome prediction |
| Best placement in pitch | High-stakes example of clinical reasoning and personalized risk | Primary demo of proactive, routine longitudinal monitoring |

## Recommended pitch narrative

1. **Show the problem:** Spacecraft can generate physiological, environmental and medical information, but meaningful interpretation and follow-up can remain fragmented and clinically resource-intensive.
2. **Show Demo 2 first:** Routine wearable data reveal an emerging, actionable change before clear symptoms. The system asks targeted questions, requests relevant tests, and supports preventive intervention.
3. **Show Demo 1 second:** A rare, high-stakes risk illustrates why the system also needs prior imaging, clinical history, risk-specific protocols and targeted diagnostics. It should not imply clot detection from heart rate.
4. **Close with the value proposition:** **“AstroHealth transforms passive monitoring into proactive, longitudinal clinical action—and builds the evidence needed for more personalized preventive medicine in future missions.”**

## Reusable software components demonstrated by both cases

1. **Device ingestion:** Time-stamped source data, calibration, quality and unit normalization.
2. **Longitudinal patient record:** Preflight baseline, in-flight adaptation, medications, allergies, prior diagnoses, imaging and interventions.
3. **Anomaly detection:** Clinically approved thresholds, personal baseline comparison and quality controls.
4. **Safety and triage engine:** Red-flag identification, emergency bypass, escalation and approved scope of autonomy.
5. **Adaptive interview:** Context-specific symptom questions with traceable clinical rationale.
6. **Diagnostic orchestration:** Equipment-aware test recommendations, guided acquisition and result ingestion.
7. **Evidence-based reasoning:** Differential assessment, uncertainty display and provenance/versioning for each decision.
8. **Action and follow-up:** Clinician/protocol authorization, monitoring and reassessment.
9. **Research layer (architecture slide only):** Controlled, privacy-preserving longitudinal data extraction with outcome labels, governance and auditability.
10. **Offline operation:** Critical functionality available without real-time communications with Earth; synchronization and remote review when connections permit.

## Minimum evaluation plan for an AstroHealth prototype

| Evaluation domain | What to assess |
|---|---|
| Input reliability | Signal quality, missingness, timestamp synchronization and correct measurement units |
| Event detection | Sensitivity, specificity, alert burden and time to detection against labeled scenarios |
| Medical interview | Coverage of red flags, appropriateness and completeness of questions |
| Diagnostic test selection | Whether recommended tests are clinically relevant, available on the spacecraft and appropriately prioritized |
| Safety | Emergency escalation, unsafe recommendation rate and handling of uncertainty |
| Longitudinal record | Traceability, version control, completeness and privacy safeguards |
| Human factors | Astronaut workload, clarity, usability, trust calibration and ability to override/escalate |
| Generalizability | Performance across baseline differences, simulated mission stages and out-of-distribution cases |

No model should be described as clinically validated merely because it reproduces these scripted examples.

---

# Scientific References and Source Starting Points

1. Marshall-Goebel K, et al. *Assessment of Jugular Venous Blood Flow Stasis and Thrombosis During Spaceflight.* **JAMA Network Open** (2019). https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2755307
2. *Venous Thrombosis during Spaceflight.* **New England Journal of Medicine** (2020). https://www.nejm.org/doi/full/10.1056/NEJMc1905875
3. *Albumin, oral contraceptives, and venous thromboembolism risk in astronauts.* Research discussion (2022). https://pmc.ncbi.nlm.nih.gov/articles/PMC9126217/
4. NASA Human Research Program — Human Spaceflight Hazards. https://www.nasa.gov/hrp/hazards/
5. NASA — Spaceflight Standard Measures. https://www.nasa.gov/reference/standard-measures/
6. NASA — CIPHER: integrated spaceflight human research. https://www.nasa.gov/reference/cipher/
7. NASA — Establishing a VTE Risk Score for Astronauts Algorithm. https://www.nasa.gov/organizations/ochmo/establishing-a-vte-risk-score-for-astronauts-algorithm/
8. NASA Life Sciences Portal (physiological and analog research data). https://nlsp.nasa.gov/explore
9. NASA Open Science Data Repository. https://osdr.nasa.gov/bio/repo
10. Canadian Space Agency — Bio-Monitor wearable. https://www.asc-csa.gc.ca/eng/sciences/bio-monitor.asp

**Research note:** These links are provided for source verification and project development. Exact protocol thresholds, individual-level data availability, and current mission procedures must be checked in the most recent applicable NASA medical documents before implementation.
