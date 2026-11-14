# 03 — Problem space: data categories & known problems

Two layers of "problems":
1. **Medical problems** — what goes wrong in the body (HRP risks).
2. **Monitoring problems** — why it's hard to *notice and act* on those changes in flight. **This is where our software lives.**

---

## 1. Categories of health data in space

| # | Category | Example indicators | How it's measured in flight (today) | Can our demo capture it live? |
|---|---|---|---|---|
| 1 | **Vital signs** | HR, BP, SpO2, respiration rate, body temp | BP cuff, pulse oximeter, Astroskin/Bio-Monitor shirt, thermometer, skin-temp patch | ✅ HR via webcam (rPPG); others manual entry |
| 2 | **Cardiac electrophysiology** | ECG rhythm, HRV | Holter (JAXA), ECG shirt | 🟡 HRV from rPPG (rough) or PhysioNet replay |
| 3 | **Imaging** | Ultrasound (heart, jugular vein, eye), fundoscopy, OCT | Remotely-guided ultrasound, fundoscope | 🟡 guided-procedure UI + image upload |
| 4 | **Vision / neuro-ocular** | Near visual acuity, Amsler grid distortions, headache | Eye charts, Amsler grid, fundus | ✅ in-browser acuity + Amsler grid |
| 5 | **Body composition & musculoskeletal** | Body mass, muscle strength, bone density | Mass measurement device (SLAMMD), exercise device loads; DXA only pre/post | 🟡 manual entry + exercise logs |
| 6 | **Biochemistry** | Blood glucose, urine (hydration, calcium → stones), saliva (cortisol, immune), blood counts | Point-of-care devices, samples returned to Earth | 🟡 manual entry |
| 7 | **Sleep & circadian** | Sleep duration/quality, timing, light exposure, caffeine, hypnotics | Actigraphy (ARCHeR, Actiwatch), sleep logs | ✅ sleep log; 🟡 wearable import |
| 8 | **Cognitive & behavioral** | Mood, stress, reaction time (PVT), cognition battery, team conflict | NASA Cognition battery, questionnaires, journals | ✅ PVT + mood check-in in browser |
| 9 | **Nutrition & hydration** | Calories, protein, vitamin D, fluid intake | Food logging (EveryWear barcode scanning) | ✅ food/water log |
| 10 | **Exercise / countermeasure adherence** | Minutes, load, aerobic HR zones | Exercise devices (treadmill, cycle, resistive) | ✅ log + HR |
| 11 | **Symptoms** | Headache, congestion, rash, back pain, nausea, cold sores, flank pain | Self-report | ✅ symptom check-in |
| 12 | **Environment (hazard exposure)** | ppCO2, radiation dose & SEP alerts, noise, temperature, O2, dust | Cabin sensors, dosimeters | ✅ **real feeds** (DONKI/NOAA) + simulated cabin |
| 13 | **Mission context** | Mission day, gravity level, workload, EVA schedule, comm delay | Timeline/planning | ✅ mission-profile simulator |

---

## 2. Hazard → risk → indicators → action map (the knowledge core of the app)

| Body system | Hazard(s) | Key risk(s) | Indicators | Attention triggers (examples) | Actions / countermeasures |
|---|---|---|---|---|---|
| **Cardiovascular** | Gravity, radiation | CV adaptation, orthostatic intolerance at landing, arrhythmia, venous thrombosis | HR, BP, HRV, ECG, jugular ultrasound | Sustained deviation from **personal baseline**; irregular rhythm; neck/arm swelling | Exercise, fluid loading before landing, compression garments, ultrasound check, ground consult |
| **Bone** | Gravity | Bone loss **1–1.5 %/month** (NASA); fracture; renal stones | Exercise load adherence, Ca/vit D intake, hydration, flank pain | Missed resistive sessions; low fluid intake; flank pain | Resistive exercise, nutrition, hydration, bisphosphonates (per flight surgeon) |
| **Muscle & fitness** | Gravity | Reduced cardiorespiratory & musculoskeletal fitness | Exercise HR response, strength loads, body mass | Declining performance trend | Adjust exercise prescription |
| **Eyes / brain (SANS)** | Gravity (headward fluid shift) | SANS — **~70 % of ISS astronauts** show some eye swelling (NASA) | Near acuity, Amsler grid, headache, fundus/OCT/ultrasound | New blur, distortion, persistent headache | Ocular exam, flag to ground, CO2 check (confounder) |
| **Immune** | Radiation, isolation, closed env., stress | Altered immune response, viral reactivation (cold sores, shingles), rashes, allergy | Symptoms (rash, cold sores), temp, sleep, stress, saliva markers | Fever, rash, cold sore outbreak | Hygiene, sleep, antivirals per protocol, ground consult |
| **Sleep & circadian** | Isolation, closed env. (16 sunrises/day on ISS) | Sleep loss, circadian desync, work overload | Sleep hours/quality, PVT, light, caffeine, hypnotic use | <6 h sleep several nights, PVT lapses rising | Lighting schedule, nap, workload re-plan |
| **Behavioral health** | Isolation & confinement, distance | Behavioral conditions, psychiatric disorders, inadequate teamwork | Mood, stress, PVT/cognition, social contact, conflict | Mood decline trend, anhedonia, conflict | Private conference w/ family/psychologist, leisure, crew check-in |
| **Nutrition** | Distance, closed env. | Inadequate food & nutrition; menu fatigue; vitamin degradation | Calories, protein, micronutrients, body mass | Intake below target several days; mass loss | Menu adjustment, supplements |
| **Radiation** | Radiation | Cancer, CNS, acute effects from SEP | Cumulative dose vs limit, SEP alerts | SEP event; dose rate spike; % of career limit | Shelter in storm shelter, schedule EVA around events |
| **Respiratory / environment** | Hostile closed env. | CO2 symptoms, hypoxia, dust, microbes, noise/hearing | ppCO2, O2, symptoms (headache, lethargy) | **1-h ppCO2 > 3 mmHg** (NASA-STD-3001 V2); headache rate rises ≥ ~2.5 mmHg 7-day avg | Increase scrubbing/ventilation, move modules, report |
| **Sensorimotor** | Gravity transitions | Space motion sickness, spatial disorientation, post-landing balance | Nausea, dizziness, balance tests | Gravity transition days (launch, landing, Mars arrival) | Medication, task scheduling, caution period |
| **EVA / decompression** | Hostile env., gravity | DCS, EVA injury, hypoxia | Prebreathe compliance, joint pain, hand/shoulder injury | Joint pain after EVA | DCS protocol, ground consult |
| **Medications** | Radiation, distance | Ineffective/toxic meds (degradation, expiry) | Med usage log, expiry, storage | Expired/degraded med for needed use | Substitute, ground consult |

> All numeric thresholds above are **demo-grade**; source each one in the app (link to the HRP risk page / NASA-STD-3001 / paper). Never present them as clinical advice.

### Handy numbers (with source quality)

| Fact | Value | Source | Confidence |
|---|---|---|---|
| Bone mineral density loss | 1–1.5 % / month | [NASA bone risk page](https://www.nasa.gov/reference/risk-of-spaceflight-induced-bone-changes/) | ✅ primary |
| SANS prevalence (some eye swelling) | ~70 % of ISS astronauts | [NASA SANS risk page](https://www.nasa.gov/reference/risk-of-spaceflight-associated-neuro-ocular-syndrome-sans/) | ✅ primary |
| CO2 limit | 1-h avg ppCO2 ≤ 3 mmHg; <2.5 mmHg 7-day avg → headache risk <1 % | [OCHMO CO2 brief](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf) | ✅ primary |
| ISS sunrises/day | 16 | [NASA sleep risk page](https://www.nasa.gov/reference/risk-from-inadequate-sleep-and-irregular-schedules/) | ✅ primary |
| Mars one-way comm delay | ~3–22 min | EIMO literature | ✅ |
| ISS spinal height increase | up to 3 % | NASA bone page | ✅ primary |
| In-flight sleep | ~6 h/night, frequent hypnotic use | Barger 2014 | ⚠️ verify |
| Plasma volume drop | ~10–15 % | review literature | ⚠️ verify |
| Mars dose rates | ~1.8 mSv/day cruise; ~0.64 mSv/day surface | Curiosity RAD papers | ⚠️ verify |
| NASA career radiation limit | 600 mSv effective dose | NASA-STD-3001 Vol 1 | ⚠️ verify in Rev C |

---

## 3. Known problems with health monitoring in space (our opportunity list)

| ID | Problem | Evidence | What software can do |
|---|---|---|---|
| **P1** | **Earth reference ranges don't apply.** Fluid shifts, deconditioning, and adaptation change "normal" HR, BP, etc. in each mission phase. | Fluid-shift physiology (SANS/CV literature) | Judge each value against the **astronaut's own baseline + expected adaptation curve for this mission day/gravity**, not population norms |
| **P2** | **Heavy reliance on self-report; incentive to underreport.** Crews historically reluctant to disclose symptoms (fear of losing flights). | [ISS epidemiology (NTRS)](https://ntrs.nasa.gov/citations/20160012380): in-flight data "based heavily on crewmember self-report"; STS-era reports | Add **objective micro-tests** (PVT, acuity, rPPG HR) and private-by-default design so the astronaut owns the data |
| **P3** | **Crew time is scarce; alarm fatigue.** | ISS ops constraints | ≤ 3-minute daily check; only escalate on persistent, multi-signal deviations |
| **P4** | **Non-experts perform exams.** Crew medical officers aren't necessarily physicians; ultrasound/fundoscopy are skill-heavy. | CSA Vascular Echo, remote-guided ultrasound practice | Step-by-step guided procedures with visuals; "why this exam" explainers |
| **P5** | **Distance: no real-time ground support, no evacuation.** | EIMO ConOps; Mars delay 3–22 min | **Latency-aware triage**: self-care → crew medical officer → ground, with a compact auto-generated report for delayed comms |
| **P6** | **Limited diagnostics** (mass/power/volume). | NTRS ISS epidemiology; Polk quote | Squeeze maximum signal from few sensors; fuse them |
| **P7** | **Data silos**: environment (CO2, radiation), schedule, food, physiology, and symptoms are not shown together. Causes are invisible to the crew. | CO2–headache link (Law 2014) | **Hazard-aware correlation**: "headache + ppCO2 3.4 mmHg in Node 3 → likely CO2" |
| **P8** | **Tiny n + privacy → little open astronaut data.** | OSDR/LSDA access rules | Synthetic crews from published effect sizes; personal-baseline methods that work with n=1 |
| **P9** | **Slow, cumulative risks are invisible day-to-day** (bone, radiation, SANS). | Bone 1–1.5 %/mo; radiation limits | **Projection**: "at current adherence, estimated bone loss at landing ≈ X %"; radiation budget gauge |
| **P10** | **Mission phase & gravity transitions** change what to watch (launch, adaptation, EVA, lunar surface, landing). | Sensorimotor/CV risks | Phase-aware checklists and thresholds |
| **P11** | **Behavioral health stigma & team dynamics.** | HRP behavioral + teamwork risks | Private mood tracking, gentle prompts, crew-level (anonymized) cohesion signals |
