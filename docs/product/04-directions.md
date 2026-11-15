# 04 — Candidate directions & recommendation

> **Superseded:** the team chose the ORBIVIT closed loop in [06-orbivit-concept.md](06-orbivit-concept.md) instead of this MVP ([ADR 0001](../adr/0001-orbivit-replaces-baseline-mvp.md)). Kept for the research and scoring.

Space Apps judging criteria: **Impact · Creativity · Validity · Relevance · Presentation**. Scores below are 1–5 against those, plus hackathon feasibility.

## Candidates

### A. "Personal-baseline self-triage" (Earth-independent health copilot) ⭐ recommended core
Every reading is judged against **the astronaut's own baseline + expected adaptation for this mission day and gravity level** (P1), fused with **cabin environment and radiation** (P7), and routed through **latency-aware triage**: self-care → crew medical officer → ground, with an auto-written compact report for delayed comms (P5). Body-map UI, color status, trends, projections for slow risks (P9).
- Problems hit: P1, P5, P7, P9, P10 · Impact 5 · Creativity 4 · Validity 5 · Relevance 5 · Feasible 4

### B. "Mind & Sleep" behavioral health monitor
3-minute daily check: mood, sleep log, **in-browser PVT reaction test**; detects cognitive/mood drift and sleep debt; crew cohesion signals.
- Problems hit: P2, P3, P11 · Impact 4 · Creativity 3 · Validity 5 · Relevance 4 · Feasible 5

### C. "Exam coach" — camera-based objective micro-tests & guided procedures
Webcam heart rate (rPPG), near-vision acuity + Amsler grid for SANS, guided ultrasound/fundoscopy walkthroughs with image capture.
- Problems hit: P2, P4, P6 · Impact 4 · Creativity 5 · Validity 3 (rPPG accuracy) · Relevance 4 · Feasible 3

### D. Countermeasure coach + gamification
Exercise/nutrition/hydration adherence, streaks, crew challenges, bone-loss projection.
- Problems hit: P3, P9 · Impact 3 · Creativity 3 · Validity 4 · Relevance 4 · Feasible 5

### E. Ground flight-surgeon dashboard
Multi-crew telemetry console for the ground.
- Off-brief (challenge = astronauts assess **themselves**). Not recommended except as a "ground view" export of A.

## Recommendation: build **A as the spine**, borrow the best demo moments from B and C

**Vision (one line):**
> *On Mars, your flight surgeon is 20 minutes away. Our tool gives every astronaut the judgment to know what's normal **for them, today, in this gravity** — and what to do next.*

**Working name:** `BASELINE` (placeholder — rename freely).

### Why this wins
1. **It answers the brief's five questions by design** — every indicator card has: how to measure · why · how hazards affect it · when to escalate (crew vs ground) · what to do.
2. **It's grounded in NASA's own strategic gap** (EIMO, Earth-independent ops risk) rather than a generic health app.
3. **It's honest about data**: synthetic crew seeded from published effect sizes + real space-weather feeds + live measurements in the demo.
4. **Clear differentiation from prior art**: EveryWear (CNES) collects & sends data to the ground; Astroskin measures; CMO-DA answers questions. Ours **interprets against personal adaptation curves, fuses hazards, and decides who needs to know**.

### MVP for the hackathon (must-have)
1. **Mission profile switch**: ISS / Lunar surface (Artemis) / Mars transit / Mars surface → changes gravity, dose rate, comm delay, available equipment.
2. **Body map** (clickable SVG) → system → indicators, HRP risk, live status color.
3. **Daily 3-minute check-in**: vitals entry, sleep, mood, symptoms, + **PVT reaction test** (from B).
4. **Personal-baseline engine**: preflight baseline + expected-adaptation band per mission day; flags persistent multi-signal deviations (not single spikes).
5. **Hazard panel**: ppCO2 (simulated cabin), radiation dose budget + **real SEP events from NASA DONKI / NOAA SWPC**.
6. **Triage & action cards**: green/amber/red; self-care steps; "message to ground" auto-summary sized for delayed comms with delay countdown.
7. **Synthetic crew generator**: 4 astronauts × N mission days with realistic drifts + 2–3 scripted incidents (CO2 headache, SEP storm, sleep-debt spiral, early SANS sign).

### Nice-to-have (pick by time left)
- Webcam HR (rPPG) and in-browser acuity/Amsler grid (from C).
- Slow-risk projections: bone-loss-at-landing estimate vs exercise adherence; radiation % of career limit.
- Gamification: crew streaks for countermeasure adherence (from D).
- LLM "explain this to me" with offline fallback text (note: must work without Earth link).

### Demo story (3 minutes)
Mars transit, day 143. Commander's check-in: mild headache, PVT slower. App correlates with ppCO2 trend → amber, "likely CO2", action + auto-flag to life support. Then DONKI SEP event arrives → red for EVA crew, shelter instruction, dose budget updates. Close on the 20-minute delayed "message to ground" auto-report.

### Risks to manage
- **Medical-advice liability** → label as decision support; every threshold links to its source.
- **Overclaiming accuracy** (rPPG, synthetic data) → transparency slide.
- **Scope creep** → MVP list above is the contract.
