# 12 — Offline model (milestone 2): design, evaluation and results

This doc specifies how ORBIVIT runs its clinical reasoner with no link to Earth, and how we decide whether an offline model is good enough. The decisions are in [ADR 0004](../adr/0004-offline-model-is-milestone-2.md). The research behind them is in [11-offline-medical-ai-landscape.md](11-offline-medical-ai-landscape.md). Terms follow [GLOSSARY.md](../../GLOSSARY.md).

**Status:** built; model runs in progress. §6 holds the results.

## 1. What changes

| Part | Milestone 1 | Milestone 2 |
|---|---|---|
| Reasoner during a comm blackout | No-LLM fallback | **Offline model** (Ollama on the MacBook); the fallback only if no offline model is set |
| Reasoner with the link up | Claude | Claude, or the offline model alone with `LLM_PROVIDER=ollama` |
| Output that does not parse | Fallback at once | One retry, like a guardrail rejection |
| Prompt | Rules + catalog | Rules + catalog + **terminology** with standard codes and UCUM units (§3) |
| FHIR export | Test `Task` named in text | Test `Task` coded in `urn:orbivit:test` |
| Presenter bar | Provider and model | Plus an **OFFLINE MODEL** or **ONLINE** badge |

The guardrails do not change. The model still only proposes; the investigation engine decides (ADR 0002, ADR 0010).

## 2. Runtime

- **Ollama** 0.40.16 serves the model on `127.0.0.1:11434`. It runs with `OLLAMA_CONTEXT_LENGTH=32768`: the default context is shorter than the catalog prompt, and Ollama truncates a long prompt with no error. The server warns when a prompt uses more than 80 % of the context.
- **AI SDK provider:** `@ai-sdk/openai-compatible` 3.0.82 against Ollama's OpenAI-compatible endpoint, with `supportsStructuredOutputs: true`. We pinned the version whose `@ai-sdk/provider` (4.0.35) matches `ai` 7.0.159. We rejected `ollama-ai-provider-v2`: it needs zod 4, and the repo uses zod 3.25.
- **Structured output, not tool calls.** The reasoner sends the `ProposalSchema` as a JSON schema. A model with no tool support (MedGemma) can still take part.
- **Timeout:** a call that takes longer than `REASONER_TIMEOUT_MS` (default 90 s) is aborted, and the fallback takes the step. A slow model cannot stop the replay.
- **Configuration** (`.env`): `OFFLINE_LLM_MODEL`, `OFFLINE_LLM_REASONING` (gpt-oss only), `OLLAMA_BASE_URL`, `OLLAMA_CONTEXT_LENGTH`, `REASONER_TIMEOUT_MS`. At startup the server checks that Ollama runs and has the model.

## 3. Standardised input and output (ADR 0011)

The model reads the same coded data that the FHIR export writes:

- **TERMINOLOGY block** in the system prompt, built from the registries in `catalog/`:
  - each finding that the catalog uses, with its display name, its polarity and its nearest standard code, for example `f-fever: Fever [SNOMED CT 386661006, equivalent]`;
  - each measure that a test returns, with its display name and UCUM unit, for example `systolic-bp: … (UCUM mm[Hg])`.
- Test results in the event log already carry the measure ID, the value and the UCUM unit.
- The model answers only with **catalog IDs** (local codes). `fhir.ts` maps them to SNOMED CT, LOINC and ICD-10-CM. The model never writes a standard code, so it cannot invent one.
- The prompt change applies to Claude too, so the Claude reference in §6 was run after it.

## 4. Evaluation harness

`pnpm eval:offline --model <ollama model> [--runs N] [--case ID] [--reasoning low|medium|high]`. Use `--provider anthropic` for the online reference and `--provider none` for the fallback floor.

- It plays each case headless, with the scripted answers and the case's live-branch overrides.
- It exports the run as a FHIR R4 Bundle and **scores the Bundle**: the conditions with their verification and clinical status, the coded test Tasks, the pathway action Tasks, the escalations, and one Provenance agent per reasoner step. A run is judged on the record the ground would receive, not on internal state.
- A **network guard** fails any request to a host other than this machine (criterion 4).
- Results: `eval/results/*.json` (git-ignored). The summary table goes into §6.
- Code: `apps/server/src/eval/` (`cases.ts`, `score.ts`, `run.ts`). `score.test.ts` checks each scoring rule on fallback runs.

## 5. Cases and gate

The main demo gates (ADR 0012). Each expectation cites a step of [08-clinical-demos.md](../product/08-clinical-demos.md) or a catalog entry; none is a clinical threshold.

| Case | Overrides | Runs | Pass when the Bundle shows |
|---|---|---|---|
| `main-base` (gates) | none | 10 | `cv-deconditioning` is `provisional` (step 6); `t-std-exercise-test` and `t-ecg` completed before the first action (step 5; catalog: an arrhythmia argues against deconditioning); `a-countermeasure-review` accepted (step 7); the condition `resolved` (step 8) |
| `main-fever` (gates) | `q-fever` = yes | 5 | `q-fever` asked (step 4, question 4); `t-temp` completed before any action (catalog: fever argues against deconditioning and supports infection, whose test is `t-temp`) |
| `main-chest-pain` (gates) | `q-chest-pain` = yes | 1 | escalation and no action (red flag; the engine decides, a sanity check) |
| `secondary-base` (report only) | none | 2 | `ijv-thrombosis` provisional; `t-ultrasound-ijv` before the action; escalation |

**Gate** (ADR 0004): pathway safety in every run; ≥ 80 % of runs pass in each gating case; median call ≤ 20 s; no network guard hit; ≥ 90 % of reasoner steps by the model.

Model choice: among models that pass the gate, the highest agreement wins, then the lowest latency. If no model passes, we keep the fallback for blackouts and report which gate failed.

## 6. Results

Machine: MacBook Pro, Apple M4 Pro, 48 GB, Ollama 0.40.16, 4-bit models, context 32768.

| Model | main-base | main-fever | main-chest-pain | secondary (report) | Median s/call | p90 s | Event min | Model steps | Rejected | Gate |
|---|---|---|---|---|---|---|---|---|---|---|
| rule-based fallback (floor) | 0/1 | 0/1 | 1/1 | 0/1 | – | – | 0 | – | 0 | FAIL (no ranking; never asks about fever) |

The fallback fails `main-base` only on the ranking: it lists `cv-deconditioning` as `differential`, because it does not rank (ADR 0010). Its steps and its action are correct.

## 7. Limits

- The cases are scripted. Passing them does not validate a model clinically (08, "Minimum evaluation plan").
- The network guard covers the Node process. A Wi-Fi-off run before the pitch covers the rest.
- No offline model has flight-validated accuracy, including this one (doc 11 §5).
