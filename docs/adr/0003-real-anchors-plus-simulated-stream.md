# Replay real astronaut anchors with a simulated stream between them

No open dataset has a continuous stream of real astronaut vitals. Inspiration4 (OSD-575, OSD-569) has real labs for 4 astronauts, but only before launch and after return. Shuttle STS-40 (NLSP 178066) has one averaged in-flight value per subject. So the replay uses real values as anchors (personal baselines and lab draws) and a simulated stream, seeded from published effect sizes, between them. One scripted incident starts the investigation. Every value on screen is labeled REAL or SIMULATED. We rejected a replay of analog-crew data (NEEMO, bed rest), because those subjects are not astronauts.

Never combine real values from two different people into one astronaut: that would be a fabricated record.

## Anchors per demo (ADR 0008)

- **Demo 2, deconditioning:** the astronaut is subject 1 of NLSP 178066 (STS-40/58). Real: pre-flight and in-flight resting heart rate, BP, cardiac output, stroke volume. Simulated: exercise heart rate at matched workload (seeded from the real STS-40 group slope) and the long-mission trend. Reference band: DSO 402 post-flight stand test (26 other astronauts).
- **Demo 1, venous thrombosis:** the astronaut is Inspiration4 subject C003 (OSD-575, OSD-569), the subject with the lowest mean pre-flight albumin (4.50 g/dL). Real: pre-flight labs in the imported record, including albumin. Simulated: all in-flight vein findings, seeded from the group counts in Marshall-Goebel 2019 and labeled so.

The UI uses three labels: REAL, SIMULATED, REFERENCE.

Exception: Demo 1 combines two real astronauts under the conditions in ADR 0009.
