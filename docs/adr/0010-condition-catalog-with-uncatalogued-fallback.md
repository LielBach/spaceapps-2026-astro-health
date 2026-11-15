# Condition catalog with LLM reasoning, and an uncatalogued fallback

To show that ORBIVIT handles health conditions in general, not two scripted cases, the clinical knowledge is a **condition catalog** of about 10–15 spaceflight conditions from the HRP risk list. Each entry lists its findings, the tests that confirm or rule it out, the actions and a source. An LLM drafts the catalog once, and the team reviews it. At run time the LLM reasons over the whole catalog: it ranks suspected diagnoses with confidences, cites evidence from the event log for each, and picks the next step. This widens ADR 0002. We rejected per-case pathways with fixed evidence weights: they are repeatable, but they only demonstrate the cases we wrote.

**Guardrails in code (always on):** red flags stop the investigation and escalate; tests must be on the onboard equipment list; the minimum-evidence rule must pass; every cited piece of evidence must exist in the event log. Output that fails a check is rejected and logged.

**Uncatalogued fallback:** when no catalog condition explains the evidence (the LLM reports no catalog match, or every catalog score stays below a set level), the LLM may name a diagnosis outside the catalog. Then:
- The UI labels it **UNCATALOGUED – not from an approved pathway**.
- Its only allowed actions are more questions, tests on the equipment list, and escalation to the crew medical officer and the ground. It never recommends a treatment.
- The event always escalates.

**No LLM (comm blackout in milestone 1):** catalog findings give an unranked list of possible causes, and tests run in a fixed order. With no catalog match, the event escalates.

The demo proves generality with a live branch: the presenter gives a different answer, and the ranking and the next tests change.
