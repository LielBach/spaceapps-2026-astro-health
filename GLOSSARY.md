# ORBIVIT

Decision-support software that watches an astronaut's health data, starts an investigation when it finds a deviation, and guides the astronaut to the next action.

## Loop

**Closed loop**:
The five stages of every event: detect → investigate → assess → act → learn. Investigate holds verify, alert, ask and test. Act holds monitor.
_Avoid_: Detect → verify → alert → ask → test → assess → act → monitor → learn (as the loop name), pipeline, workflow

## People

**Astronaut**:
The only interactive user. The astronaut answers questions, does tests and acts on the result.
_Avoid_: Patient, user, crew member (when one specific person is meant)

**Crew medical officer**:
The crew member who receives an escalation when the astronaut cannot resolve it alone.
_Avoid_: CMO (in UI text), doctor

**Ground**:
The flight surgeon team on Earth. It receives escalations through a delayed link.
_Avoid_: Mission control, Earth

## Assessment

**Possible cause**:
One candidate explanation for a deviation that the investigation tries to rule in or out.
_Avoid_: Hypothesis, theory

**Suspected diagnosis**:
A possible cause that the evidence supports, shown in a ranked list with a confidence, the evidence for and against, and the test that would confirm it. The crew medical officer confirms it. The system shows one only after the minimum-evidence rule passes.
_Avoid_: Diagnosis (without "suspected" in UI text), result

**Resolved event**:
An event that the system closes because follow-up measurements returned to the personal baseline after the recommended action. If they do not return, the system escalates to the crew medical officer instead.
_Avoid_: Fixed, solved, cleared

**Condition catalog**:
The reviewed list of spaceflight conditions the system knows, each with its findings, confirming and ruling-out tests, actions and source (ADR 0010).
_Avoid_: Knowledge base, database, ontology

**Approved pathway**:
The questions, tests and actions that one condition catalog entry allows. The system may only recommend an action from an approved pathway.
_Avoid_: Protocol (unless it is a NASA protocol), flow, script

**Equipment list**:
The tests and devices that the spacecraft carries. The system may only request a test on this list.
_Avoid_: Inventory, kit

**Uncatalogued diagnosis**:
A suspected diagnosis outside the condition catalog, allowed only when no catalog condition explains the evidence. It may lead only to more questions, tests on the equipment list and escalation, never to a treatment.
_Avoid_: Unknown condition, free diagnosis

## Signals

**Passive signal**:
A value that a worn sensor measures continuously with no action from the astronaut, such as heart rate, heart-rate variability, respiratory rate, skin temperature, SpO2 or activity. Records that the exercise device makes during scheduled exercise (workload, duration, heart rate at workload) also count. Only passive signals can start an event.
_Avoid_: Vital (for active tests too), reading

**Surveillance trigger**:
A scheduled check that an approved pathway sets from the medical record, such as a past abnormal finding plus a risk score. It can start an event with no passive-signal change. Passive signals stay the only trigger for unscheduled events.
_Avoid_: Screening (unless it is a NASA screening protocol), reminder

**Active test**:
A measurement or answer that the astronaut must do on request, such as BP, body mass, a fluid intake answer or a fingerstick cartridge. Active tests investigate an event but never start one.
_Avoid_: Check, exam

**Sleeping heart rate**:
The heart rate during sleep, as confirmed by the activity sensor. Exercise and excitement cannot explain a rise in it, so it is the main trigger signal.
_Avoid_: Resting heart rate (when sleep is meant), night HR

## Alerting

**Silent watch**:
The state of an astronaut when one signal deviates. The system keeps watching and does not contact the astronaut.
_Avoid_: Warning, pre-alert

**Check-in question**:
The first contact when two signals agree. It appears inside the daily check-in, not as a push, and a one-tap benign answer closes the event.
_Avoid_: Alert, notification

**Urgent interrupt**:
An immediate push to the astronaut. Only a critical threshold triggers it, and it skips the other filters.
_Avoid_: Alarm, emergency (unless an emergency pathway starts)

**Event log**:
The append-only record of every step of every event, one JSON Lines file per replay run.
_Avoid_: Medical record, EHR, history

## Data

**Real anchor**:
A measured value from a real astronaut in an open dataset, such as an Inspiration4 lab result. It sets a personal baseline or appears as a lab draw in the replay.
_Avoid_: Ground truth, real data (without saying which values)

**Measure**:
A kind of thing that is measured, such as sleeping heart rate or serum albumin, with one fixed meaning and unit.
_Avoid_: Signal (for labs), metric (outside detection), parameter

**Measurement**:
One value of a measure for one astronaut at one mission time, with its unit, source and data label.
_Avoid_: Reading, vital, data point

**Local code**:
An ORBIVIT code for a measure, finding or condition that has no exact standard code. It always states the nearest standard code and how close that code is.
_Avoid_: Custom code, internal ID

**Composite astronaut**:
A demo astronaut whose real values come from two different real people. Only Demo 1 has one (ADR 0009), and the UI marks it COMPOSITE with both sources.
_Avoid_: Real astronaut, synthetic astronaut

**Reference band**:
A range taken from group data of other real astronauts, shown next to one astronaut's values for comparison. It is never shown as that astronaut's own value.
_Avoid_: Normal range, population range

**Simulated stream**:
Generated vitals that fill the time between real anchors, seeded from published effect sizes.
_Avoid_: Fake data, mock data

**Replay**:
Playback of one astronaut's mission timeline at high speed, so the demo shows the system act without a prompt.
_Avoid_: Simulation (for the whole demo), playback
