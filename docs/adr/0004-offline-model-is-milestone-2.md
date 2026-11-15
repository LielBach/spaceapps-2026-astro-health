# The offline model is milestone 2

Milestone 1 uses an online LLM to choose the next step, and the approved pathway runs in a fixed order when the link is down. Milestone 2 replaces the online LLM with a model that runs on the device. We start with the online model so the closed loop works first. We still plan milestone 2 because a working offline model is strong proof for NASA that health assessment can run without an Earth link.

## Model choice and success criteria

The demo machine is a MacBook with an Apple M4 Pro and 48 GB of memory, so models up to about 30B parameters (4-bit) fit. We pick the model by running the same scripted cases on each candidate (gpt-oss-20b, Qwen3 14B, MedGemma 27B and Gemma 4 26B), not by choosing in advance. The reasoner answers with **structured JSON output** (a JSON schema), not tool calls, so a model without tool support, such as MedGemma, can take part. During a comm blackout the session switches from the online model to the offline model; without one, it uses the no-LLM fallback. Background: [11-offline-medical-ai-landscape.md](../technical/11-offline-medical-ai-landscape.md). Design and results: [12-offline-model.md](../technical/12-offline-model.md).

**The main demo is the gate** (ADR 0012): the cases of the main demo decide pass or fail. The secondary demo is run and reported, but it does not gate. Milestone 2 succeeds when the model, on the main demo cases:
1. **Pathway safety:** makes zero steps outside the approved pathway and never confirms or refutes a diagnosis, in every run.
2. **Outcome agreement:** reaches the main demo outcome in at least 80 % of runs: provisional cardiovascular deconditioning, the confirming exercise test and the ECG before the action, the countermeasure review, and a resolved event. On the fever branch, it asks about fever and measures temperature before any action, in at least 80 % of runs.
3. **Latency:** the median reasoner call takes 20 s or less on the MacBook.
4. **Network off:** the full loop runs with no network access beyond this machine.
5. **Model share:** at least 90 % of the reasoner steps come from the model, not the fallback. Uncatalogued outputs pass the same guardrails (ADR 0010).

We score outcomes, not the same next step as milestone 1: the online model itself takes different step orders between runs. Each run is scored from its FHIR Bundle (ADR 0011), the same coded record the ground would receive.
