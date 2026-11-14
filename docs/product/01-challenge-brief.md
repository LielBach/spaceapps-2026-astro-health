# 01 — Challenge brief (decoded)

**Challenge:** [Create Health Monitoring Software for Astronauts on Space Missions](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/) — NASA Space Apps 2026
**Difficulty:** Intermediate · **Subjects:** Human Exploration, Software, Space Exploration
**Resources tab:** 5 links (NASA HRP hazards, risks and ongoing research; 2 CSA articles), no datasets. What they lead to is in [05-data-sources.md](../technical/05-data-sources.md).

## What they literally ask for

> Build a **visual tool** that helps astronauts **assess their own health** during missions and **provides guidance on treatments and health improvements**.

- Input can be anything: keyboard, clicks, camera images. Any data counts if it represents a health indicator (e.g. blood sugar in mg/dL, ultrasound images).
- Example indicators named: blood pressure, heart rate, blood sugar, body temperature, daily sleep hours, mood.
- Use NASA HRP + other agencies' public resources to decide **which indicators matter** and **how they support a quick assessment**.

## The five questions the brief tells us to answer (judges will look for these)

1. Which measurements can be performed in space?
2. Why is each exam needed?
3. How do spaceflight hazards affect each indicator?
4. When does a result warrant attention from the **crew** vs **flight surgeons on the ground**?
5. What actions prevent a critical condition?

## Optional features they hint at

| Hint | Notes for us |
|---|---|
| Different environments: spacecraft, station, rover, planetary base | → a **mission profile** switch (ISS / lunar / Mars transit / Mars surface) changing gravity, radiation, comm delay, available equipment |
| Prompt measurements as part of mission routine | → scheduler / daily "health ops" checklist |
| Gamification | → streaks, crew-level goals; careful not to trivialize medicine |
| Dynamic charts over time | → trends vs personal baseline |
| Color coding at a glance | → green / amber / red status |
| Clickable human body figure | → body map, each system → indicators, risks, status |
| Don't assume astronauts are experts | → step-by-step "how to measure" + "why it matters" cards |

## Framing the five hazards (NASA HRP, "RIDGE")

**R**adiation · **I**solation & confinement · **D**istance from Earth · **G**ravity fields · hostile/closed **E**nvironments.
The brief explicitly names: immune changes, bone loss, cardiovascular events, inadequate nutrition, behavioral health.

## Context that makes this timely

- **Artemis II** flew the first crewed lunar flyby, splashing down **April 10, 2026**. Crew health studies on board: **ARCHeR** (wrist actigraphy: sleep/activity/alertness), **Immune Biomarkers** (dried saliva booklets), **AVATAR** (organ-chips from crew cells), plus post-flight standard measures (BP, HR, eye health, motor control). Published results not out yet.
- NASA + Google prototyped **CMO-DA** (Crew Medical Officer Digital Assistant), an AI clinical decision-support proof-of-concept tested on simulated ankle injury, flank pain, ear pain scenarios — still not operational.
- NASA's **EIMO** (Earth-Independent Medical Operations) concept is exactly the problem this challenge points at: shifting medical decision-making from the ground to the crew.
