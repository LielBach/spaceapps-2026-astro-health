# 07 — Demo case brief

Context for defining the demo case of AstroHealth. This file stands alone: you can paste it into another assistant or give it to a teammate.

The team chose two demos (ADR 0008); their step-by-step workflows are in [08-clinical-demos.md](08-clinical-demos.md). Decisions here come from a design interview. They are recorded in [GLOSSARY.md](../../GLOSSARY.md) and [docs/adr/](../adr/). Items marked *(verify)* need a source before they appear in the UI or the pitch.

## 1. The product in short

- **Event:** NASA Space Apps 2026, challenge "Create Health Monitoring Software for Astronauts on Space Missions". The brief asks for software that astronauts use to **assess themselves**.
- **Product:** AstroHealth, a proactive decision-support system. It watches passive sensor data, starts an investigation without a prompt when it finds a deviation, and guides the astronaut to a resolution.
- **Loop:** detect → investigate → assess → act → learn.
- **Primary user:** the astronaut. The crew medical officer and the ground only receive escalations.
- **Setting:** a long mission, such as Mars transit. The link to Earth has a long delay or is down, so the system must work without it.

## 2. What the demo must show

The demo is a **replay**: one astronaut's mission timeline, played back at high speed (ADR 0003). In about 3 minutes it must show:

1. The system ignores at least one **benign** change, such as exercise or excitement, so judges see that it does not overreact.
2. The system **detects** a real deviation from **passive signals only**, with no action from the astronaut.
3. The system **starts the investigation itself**: a check-in question, then active tests, cheapest first.
4. The system shows a ranked list of **suspected diagnoses** that changes as evidence arrives.
5. The system recommends **one action** from an approved pathway.
6. The system **closes the event** when follow-up passive data returns to baseline, or escalates if it does not.
7. At least one moment uses a **real astronaut value** (a real anchor), and the UI labels it REAL. Generated values are labeled SIMULATED, and group data from other real astronauts is labeled REFERENCE.

## 3. Hard constraints for the demo case

### Hazard

The condition in the demo must come from **one of the five spaceflight hazards** that the challenge names. The challenge's Resources tab links to the [NASA HRP hazards page](https://www.nasa.gov/hrp/hazards/), and the brief asks "How do spaceflight hazards affect each indicator?". A case with no hazard link does not answer the challenge.

The five hazards (NASA HRP, "RIDGE"):

| Hazard | Examples of what it does to the body |
|---|---|
| **R**adiation | Acute radiation effects after a solar particle event; long-term cancer and tissue risk |
| **I**solation and confinement | Sleep loss, mood and cognitive changes, crew conflict |
| **D**istance from Earth | Long comm delay, no evacuation, limited supplies: the crew must act alone |
| **G**ravity fields | Fluid shift, lower plasma volume, cardiovascular deconditioning, bone and muscle loss, eye changes (SANS) |
| hostile/closed **E**nvironments | High cabin CO₂, closed air and water systems, microbes, immune changes |

The brief also names immune changes, bone loss, cardiovascular events, inadequate nutrition and behavioral health.

Rules for the demo case:

- The demo must say which hazard causes the condition, and how, with a link to the NASA HRP risk page.
- **Distance from Earth** applies to every case on a Mars mission: it is why the crew cannot wait for the ground. It may add drama, but it does not count as the cause of the condition. One of the other four hazards must cause it.
- The passive signals in the trigger must be ones that this hazard is known to change. Link a source for each signal.

- **Only passive signals start an unscheduled event.** A passive signal is measured continuously by a worn sensor, with no action from the astronaut. Records that the exercise device makes during scheduled exercise (workload, duration, heart rate at workload) also count.
- A **surveillance trigger** can also start an event: an approved pathway schedules a check from the medical record (for example a past abnormal finding plus a risk score), even with no passive-signal change.
- The available passive signals are those a current wearable such as CSA's Astroskin measures *(verify)*: heart rate, heart-rate variability (HRV), respiratory rate, skin temperature, SpO₂, and activity (accelerometer). Sleep is detected from activity.
- There is **no continuous blood pressure**, **no continuous body mass**, and **no automatic fluid intake**. These are active tests.
- **Active tests** need the astronaut to act. They investigate an event but never start one. Examples: answers to questions, BP cuff, body mass (the ISS uses SLAMMD *(verify)*), urine color, temperature, ECG, and a fingerstick blood cartridge such as i-STAT *(verify)*. The cartridge is a limited consumable, so it comes last.

### Alert filters

An event must pass these filters before the astronaut sees anything:

1. **Context:** the system ignores readings explained by exercise, EVA, docking or another timeline item, and readings with low signal quality.
2. **Space-adjusted band:** each signal is compared to the expected in-flight band for this astronaut and this mission day, not to Earth reference ranges. Example: real STS-40 data shows that resting heart rate falls in flight, so a return to the pre-flight level is already a deviation.
3. **Persistence:** the deviation lasts across several resting windows, for example 3 nights. One spike is not enough.
4. **Two signals:** one deviating signal puts the astronaut on **silent watch**, with no contact. A second passive signal that agrees triggers a **check-in question** inside the daily check-in.
5. **Urgent interrupt:** only a critical threshold skips the filters and pushes an alert at once.

The numbers in the filters (such as 3 nights) are design parameters, not validated values. The UI marks them as illustrative until we have a source.

### Diagnosis and actions

- Suspected diagnoses show as a ranked list. Each has a confidence, the evidence for and against, and the test that would confirm it. The list is labeled "Suspected – for crew medical officer confirmation" (ADR 0005).
- One abnormal reading never gives a diagnosis. A minimum-evidence rule must pass first.
- The LLM picks the next question or test, but **only from an approved pathway**. It never invents tests, medications or doses (ADR 0002). Actions must use equipment and supplies a spacecraft would carry.

### Data

- No open dataset has a continuous stream of real astronaut vitals.
- **Real anchors** come from Inspiration4 on NASA OSDR. These are real lab values for 4 astronauts (C001–C004), each with a lab reference range:
  - OSD-575: comprehensive metabolic panel (glucose, BUN, creatinine, sodium, potassium, chloride, CO₂, calcium, protein, albumin, bilirubin, ALP, AST, ALT) and a cardiovascular panel.
  - OSD-569: complete blood count (WBC, RBC, hemoglobin, hematocrit, platelets, neutrophils, lymphocytes).
  - Time points: 92, 44 and 3 days before launch, and 1, 45, 82 and 194 days after return. **No in-flight samples.**
- Shuttle STS-40 (NLSP 178066) gives one averaged pre-flight and in-flight resting value per subject (6 subjects): heart rate, BP, cardiac output, stroke volume.
- Shuttle DSO 402 (NLSP) gives per-subject supine and standing heart rate and BP before and after flight (22 subjects). Use it only as a REFERENCE band for other astronauts.
- Marshall-Goebel 2019 (JAMA Network Open, **CC-BY**) has real ISS ultrasound images of the internal jugular vein: Figure 3B (pre-flight, normal flow) and Figure 3C (flight day 50, thrombus). It gives only group counts of flow grades, not per-astronaut values.
- **Never combine real values from two people in one astronaut.** The one exception is Demo 1's Maya, marked COMPOSITE in the UI with both sources (ADR 0009).
- Passive signals are a **simulated stream**, seeded from published effect sizes, that fills the time between real anchors. One scripted incident starts the investigation.
- A good demo case uses a real anchor at a visible step. Example: a cartridge result compared to that astronaut's real pre-flight value.

### Project rules

- Every threshold or number in the UI carries a source link (NASA HRP risk page, NASA-STD-3001, OCHMO brief, or a paper).
- The app is decision support. It gives suspected diagnoses, and actions come only from approved pathways.
- It must work offline. Milestone 1 uses an online LLM with a fixed-order fallback, and milestone 2 uses a local model on a MacBook (ADR 0004).

## 4. The two chosen demos (for comparison)

Full workflows: [08-clinical-demos.md](08-clinical-demos.md). Both come from the **gravity fields** hazard.

**Demo 2 (shown first): cardiovascular deconditioning.** Alex = subject 1 of Shuttle study NLSP 178066 (REAL pre-flight and in-flight resting heart rate, BP, cardiac output, stroke volume). Trigger: heart rate at the same exercise workload rises over many sessions, and performance falls (SIMULATED, seeded from the real STS-40 group slope). Check-in question, then tests cheapest first; suspected diagnosis: reduced exercise tolerance consistent with deconditioning. Action: countermeasure review from the approved pathway. Resolve: matched-workload heart rate returns toward baseline. Gravity transition step uses a DSO 402 REFERENCE band.

**Demo 1 (second): internal jugular vein thrombosis.** Maya = COMPOSITE: REAL Inspiration4 pre-flight labs (including albumin) and REAL ISS ultrasound images (Marshall-Goebel 2019, CC-BY). Trigger: a surveillance trigger from a past abnormal flow finding; a separate sleeping-heart-rate rise opens a general assessment. The ultrasound result is entered as a structured finding (flow grade 1–5, compressibility, thrombus yes/no); AstroHealth does not read images. Suspected diagnosis: IJV thrombosis, escalated; treatment needs authorized medical oversight.

**Known weak points:**
- Demo 2: higher exercise heart rate is nonspecific; the real in-flight value comes from a 9–14-day flight, not a long mission.
- Demo 1: no wearable signal is known to precede a silent jugular clot, and the composite astronaut must be disclosed on every screen that shows it.

## 5. Criteria for a better case

Score each candidate 1–5 on:

| Criterion | Question |
|---|---|
| Passive trigger | Do only passive signals from the list above start it? |
| Benign look-alike | Is there a realistic benign cause that the filters must reject? |
| Competing causes | Are there 2–4 suspected diagnoses that passive signals alone cannot separate? |
| Cheap-first tests | Does an active test from the list separate them, cheapest first? |
| Real anchor | Can a real Inspiration4 or STS-40 value appear at a visible step? |
| Realistic action | Is the action possible with spacecraft equipment, and would follow-up passive data show recovery? |
| Hazard link | Does one of the RIDGE hazards (not only distance) clearly cause it, with an HRP risk page as the source? |
| Drama | Does it show why a 20-minute delay to Earth matters? |
| Sources | Can each threshold link to a NASA or peer-reviewed source? |

## 6. Task for the assistant

Review the two demos in [08-clinical-demos.md](08-clinical-demos.md) against sections 3 and 5. For each demo, give:

1. Every step that breaks a constraint in section 3, with the fix.
2. A score table using section 5, with one line of reasoning per score.
3. The weakest step for a 3-minute pitch, and how to make it clearer or more dramatic without breaking a constraint.
4. Any threshold, device or fact that needs a source, marked *(verify)*, with the best source you know.
5. Benign look-alikes that the alert filters must reject, and which filter rejects each one.

Do not use body mass, BP or fluid intake as a trigger. Do not invent onboard equipment or medications. Mark any fact you are not sure of with *(verify)*.
