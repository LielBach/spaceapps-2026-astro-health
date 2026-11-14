# The offline model is milestone 2

Milestone 1 uses an online LLM to choose the next step, and the approved pathway runs in a fixed order when the link is down. Milestone 2 replaces the online LLM with a model that runs on the device. We start with the online model so the closed loop works first. We still plan milestone 2 because a working offline model is strong proof for NASA that health assessment can run without an Earth link.

## Model choice and success criteria

The demo machine is a MacBook with an Apple M4 Pro and 48 GB of memory, so models up to about 30B parameters (4-bit) fit. We pick the model by running the same scripted cases on each candidate (first: gpt-oss-20b and Qwen3 14B; check the Ollama library for newer models), not by choosing in advance. Tool calling matters more than medical tuning, because the model only chooses approved pathway steps.

Milestone 2 succeeds when, on the scripted cases:
1. The model calls zero steps outside the approved pathway.
2. It picks the same next step and reaches the same suspected diagnosis as milestone 1 in at least a set share of runs.
3. Each step answers in under a set time on the MacBook.
4. The full loop runs with the network off.
5. It reaches the same top suspected diagnosis as milestone 1 (ADR 0010), and its uncatalogued outputs pass the same guardrails.

We set the thresholds for criteria 2 and 3 after the first test run.
