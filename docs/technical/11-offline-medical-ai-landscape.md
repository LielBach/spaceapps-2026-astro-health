# 11 — Offline medical AI: how NASA and tech companies approach it

This doc reports research on one question: how do NASA and technology companies plan to give a crew (or a remote clinic) medical diagnosis support when there is no link to a doctor or to a cloud LLM? It informs milestone 2 (offline model, [ADR 0004](../adr/0004-offline-model-is-milestone-2.md)) and the pitch. Terms follow [GLOSSARY.md](../../GLOSSARY.md).

**Status:** research, 2026-11-15. Most sources are vendor posts, NASA conference abstracts and news reports. Few results are peer-reviewed. Items marked *(verify)* came from secondary sources only; confirm them before use in the UI or pitch.

## 1. Summary

- **NASA's main effort is the Crew Medical Officer Digital Assistant (CMO-DA).** It is a proof-of-concept clinical decision support system (CDSS) built with Google. It started on Google Cloud (Vertex AI) in 2025. In June 2026 NASA Johnson Space Center moved it to a **fully disconnected edge deployment**: open-source models served locally by Red Hat's RamaLama on a ground twin of the HPE Spaceborne Computer that is on the ISS. It has not flown.
- **No offline space-medicine system has published accuracy numbers.** The only CMO-DA numbers are from the 2025 cloud version: three scenarios, three physician graders, 74–88 % judged likely correct.
- **NASA's stated direction is the same shape as AstroHealth:** an onboard, multi-modal, agentic CDSS that *supports* the crew medical officer, is fed by monitoring data, draws on approved evidence (a Space Act Agreement with UpToDate), and must earn crew and ground trust. NASA also says new methods must run with a reliable backup.
- **Tech companies supply parts, not a finished offline doctor.** Open-weight models (Google MedGemma, OpenAI gpt-oss, Meta Llama, EPFL Meditron) make offline inference possible. Their strongest medical results (Microsoft MAI-DxO, Google AMIE, OpenAI's Kenya study partner) come from large cloud models.
- **Terrestrial offline deployments exist but are small.** The best documented one is a fine-tuned MedGemma 4B on 8 GB Android phones in Uganda: 268 health workers, 87+ offline assessments, about 40 s per answer, no dose output. Phone memory is the main limit.
- **Main open problems everyone shares:** validated accuracy offline, hallucination control, small onboard compute, keeping knowledge current without a link, and trust.

## 2. NASA

### 2.1 Why NASA needs onboard decision support

| Fact | Source |
|---|---|
| Exploration crews must "autonomously detect, diagnose, treat, and prevent" medical events. One-way delays can exceed 20 min; evacuation and resupply may be impossible. | Russell et al. 2023, [npj Microgravity 9:47 (doi:10.1038/s41526-023-00284-1)](https://doi.org/10.1038/s41526-023-00284-1) |
| In a 26-month reference mission simulation, a crew with ISS-level crew medical officer training had up to 3 deaths. If a CDSS raised cognitive and physical scope of practice from level 1 to level 5, deaths fell by at least 34 %. Cognitive scope of practice above level 3 ("medical school graduate") was needed to reduce mission risk substantially. | Russell et al. 2023 (same) |
| The ExMC element held technical interchange meetings (2023–2024) on Earth-independent medical operations (EIMO). Recommendations: an integrated data platform (data streams, onboard databases, passive video and wearable monitoring); a **multi-modal, agentic AI CDSS** for the crew medical officer; trust from crew, CMO and ground; co-development with industry; and testing new methods during current operations **with reliable backup**. | Lemery et al., [HRP IWS 2025 abstract, NTRS 20240011658](https://ntrs.nasa.gov/citations/20240011658) |

### 2.2 Crew Medical Officer Digital Assistant (CMO-DA)

| Date | Step | Where it runs | Source |
|---|---|---|---|
| Aug 2025 | Announced by Google and NASA. "Trained on spaceflight literature". Multi-modal (speech, text, images). Outputs graded with the Objective Structured Clinical Examination (OSCE) framework. Supports, does not replace, the CMO or flight surgeon. | Google Cloud Vertex AI. NASA owns the source code; Google Cloud is a fixed-price subscription. | [Google Cloud blog](https://cloud.google.com/blog/topics/public-sector/how-google-and-nasa-are-testing-ai-for-medical-care-in-space); [TechCrunch](https://techcrunch.com/2025/08/08/nasa-and-google-are-building-an-ai-medical-assistant-to-keep-mars-bound-astronauts-healthy/) |
| Aug 2025 | First test: three scenarios, three physicians (one an astronaut) as graders. Judged likely correct: ankle injury 88 %, ear pain 80 %, flank pain 74 %. No model name, no sample size. | Cloud | [TechCrunch](https://techcrunch.com/2025/08/08/nasa-and-google-are-building-an-ai-medical-assistant-to-keep-mars-bound-astronauts-healthy/) |
| May 2026 | HRP presentation: CMO-DA uses agentic tools and "space-medicine-literate" language models. It supplements NASA's probabilistic risk assessment tool and the Integrated Medical Evidence Library. Partners Google, Microsoft and Ejenta integrated the Butterfly iQ3 ultrasound into a multi-stream data system and showed real-time diagnosis in a simulated mission. The portfolio includes ultrasound guidance from the AMOS project, Mission Control emergency procedure support, and a Space Act Agreement with UpToDate for evidence-based guidance. No metrics. | Not stated | Le, [AsMA 2026 presentation, NTRS 20260001797](https://ntrs.nasa.gov/citations/20260001797) |
| Jun 2026 | Moved "from a cloud-dependent model to a fully disconnected, edge deployment". RamaLama serves LLMs (medical reasoning) and vision language models (image-based symptom analysis) as OCI containers. Next: Red Hat Enterprise Linux AI, then a demonstration to NASA leadership, then possibly the ISS. No model names, no metrics. | **Offline**, on the ground twin of the HPE Spaceborne Computer (ISS) | [Red Hat blog, 2026-06-24](https://www.redhat.com/en/blog/moon-and-beyond-ramalama-being-tested-nasa-potentially-support-medical-ai-assistant-future-deep-space-missions); [The Register, 2026-06-27](https://www.theregister.com/ai-and-ml/2026/06/27/nasa-tests-ai-medic-for-astronauts-too-far-from-earth-to-call-a-doctor/5262828) |
| Oct 2026 | Robot that builds on CMO-DA: fetches and prepares medical equipment (example: the ultrasound for suspected kidney stone). Model: open-source Pi0, 4B parameters (Physical Intelligence), fine-tuned in 2.5 h. 85 % baseline success at finding and moving a medical bag in the lab. Works "under the astronauts' direct supervision". | Google Cloud | [Nextgov, 2026-10-28](https://www.nextgov.com/emerging-tech/2026/10/nasa-google-test-ai-powered-medical-robot-deep-space-missions/416874/) |

### 2.3 Other NASA work

| Work | What it is | Source |
|---|---|---|
| Autonomous Medical Officer Support (AMOS) | Software that guides an untrained operator through bladder and kidney ultrasound just in time. Demonstrated in an operational setting. Now part of the CMO-DA portfolio. | [NTRS 20240012964](https://ntrs.nasa.gov/citations/20240012964) |
| Clinical finding forms with Microsoft | An open-source LLM on Azure (hosted on internal NASA servers) drafts the clinical finding form for each of the 119 conditions in NASA's medical risk tool. A form took 3–4 researchers up to a month; the workflow takes a few hours. Four NASA clinicians found AI forms "essentially equivalent" for appendicitis, pancreatitis and respiratory failure. Prototype; not used for operational decisions. | [Microsoft Public Sector blog](https://techcommunity.microsoft.com/t5/public-sector-blog/how-microsoft-azure-ai-services-are-helping-astronauts-prepare/ba-p/4455212) |
| TRISH (Translational Research Institute for Space Health) | Funds space-health technology: VisualDx skin diagnosis from photos, the HERMES on-orbit data platform, Ejenta data streams. | [TRISH research](https://bcm.edu/centers/space-medicine/translational-research-institute/industry) |
| Space Llama (Meta, Booz Allen, HPE, NVIDIA) | Fine-tuned Llama 3.2 runs on HPE Spaceborne Computer-2 on the ISS with no Earth link. Use: repair and reference-document lookup, not medicine. AI tasks went from minutes to about 1 s. Follows Booz Allen's first LLM on the ISS (2024). | [Meta, 2025-04-25](https://about.fb.com/news/2025/04/space-llama-metas-open-source-ai-model-heading-into-orbit/); [Booz Allen](https://www.boozallen.com/insights/space/large-language-models-in-space-and-beyond.html) |
| Spaceborne Computer-2 hardware | HPE Edgeline EL4000 and ProLiant DL360 servers with NVIDIA T4 GPUs *(verify: T4 is from secondary coverage)*. This is the class of hardware an onboard medical LLM would get. | [HPE press release, 2021](https://hpe.com/us/en/newsroom/press-release/2021/02/hewlett-packard-enterprise-accelerates-space-exploration-with-first-ever-in-space-commercial-edge-computing-and-artificial-intelligence-capabilities.html); [AIwire](https://aiwire.net/2021/02/12/microsoft-hpe-bringing-ai-edge-cloud-to-earth-orbit-in-preparation-for-mars-missions) |

**Other agencies.** No ESA medical LLM was found. DLR, ESA and the University of Washington work on METIS, a general offline crew assistant ([arXiv 2410.16397](https://arxiv.org/abs/2410.16397)). CNES has the AMAIA crew assistant. Neither is medical.

## 3. Technology companies

| Company | Offering | Offline? | Medical evidence | Source |
|---|---|---|---|---|
| Google | **MedGemma**: open-weight Gemma 3 variants. 4B is multimodal (text and images); 27B is text-only. MedGemma 1.5 released Jan 2026 *(verify)*. | Yes (open weights; 4B runs on phones) | MedQA: 4B 64.4 % (base Gemma 3 4B 50.7 %); 27B 87.7 % with test-time scaling (base 74.9 %). Not a medical device. | [MedGemma Technical Report, arXiv 2507.05201](https://arxiv.org/abs/2507.05201) |
| Google | CMO-DA partner (above). **AMIE** conversational diagnosis research. | No (research, cloud) | Top-10 differential accuracy 59.1 % vs 33.6 % for unassisted clinicians on NEJM case reports *(verify: McDuff et al., Nature 2025)* | — |
| OpenAI | **gpt-oss-20b / 120b** open-weight models. Text only. 20b fits in 16 GB. | Yes | HealthBench (high reasoning): 20b 42.5, 120b 57.6; HealthBench Hard 10.8 / 30.0. 120b nearly matches o3; 20b slightly beats o1. "Not intended for the diagnosis or treatment of disease." | [OpenAI gpt-oss HealthBench](https://deploymentsafety.openai.com/gpt-oss/healthbench); [model card, arXiv 2508.10925](https://arxiv.org/abs/2508.10925) |
| OpenAI + Penda Health (Kenya) | GPT-4o checks clinical officers' notes in the background. | No (cloud) | Cluster-randomized trial, 16 facilities, 9,691 patients: treatment failure 2.2 % vs 2.0 %, adjusted OR 0.77 (95 % CI 0.55–1.08), not significant. Documentation and treatment planning improved. No related serious adverse events. | Nature Medicine, 2026-06-26, [doi:10.1038/s41591-026-04503-6](https://doi.org/10.1038/s41591-026-04503-6) *(verify primary)*; [Univ. of Birmingham](https://www.birmingham.ac.uk/news/2026/ai-clinical-support-tool-improved-clinician-decisions-in-real-world-primary-care-trial) |
| Microsoft | **MAI-DxO**: orchestrates several frontier models as a virtual panel of doctors. | No (cloud) | 304 NEJM cases: 85.5 % correct vs 20 % for 21 generalist physicians without references (2025 preprint). A later peer-reviewed version reports 83.2 % vs 36 % *(verify)*. No physical exam or imaging in the test. | [The Next Web](https://thenextweb.com/news/microsoft-ai-diagnosis-mai-dxo-science-study); [Maginative](https://www.maginative.com/article/microsofts-mai-dxo-crushes-doctors-at-medical-diagnosis-cuts-costs-by-70/) |
| Meta | Llama open weights; Space Llama (above). Funded EPFL **Meditron**. | Yes | — | [Meta AI blog](https://ai.meta.com/blog/llama-2-3-meditron-yale-medicine-epfl-open-source-llm/) |
| EPFL + Yale + ICRC | **Meditron** (Llama 3 8B and 70B fine-tunes) for low-resource and humanitarian settings. MOOVE: clinicians worldwide test it on real cases. | Yes | Research-only; not validated for clinical use. EPFL found small local models adequate for basic tasks, not for complex clinical reasoning. | [Hugging Face model card](https://huggingface.co/EPFLiGHT/Meditron3-70B) |
| Red Hat | **RamaLama**: runs models as OCI containers, isolated and reproducible; the CMO-DA offline runtime. RHEL AI next. | Yes | — | [Red Hat blog](https://www.redhat.com/en/blog/moon-and-beyond-ramalama-being-tested-nasa-potentially-support-medical-ai-assistant-future-deep-space-missions) |

### 3.1 Terrestrial offline deployments

| Deployment | Setup | Result | Source |
|---|---|---|---|
| EaseHealth, Crane AI Labs (Uganda) | MedGemma 4B fine-tuned with quantization-aware training, plus MedASR, on a Samsung A16 (8 GB RAM). Grounded in the Uganda Clinical Guidelines 2023. Outputs red flags, suggested checks and a confidence score; **no doses**. | 15 facilities, 268 health workers, 87+ offline assessments in 5 days. About 40 s per answer (warm). Prompting and safety filters cut hallucinations by 62 %. No accuracy numbers yet. Most workers' phones lack the RAM. | [Google HAI-DEF showcase](https://developers.google.com/health-ai-developer-foundations/showcase/crane-ai) |
| Aletheia (preprint) | Qwen2.5-3B, QLoRA fine-tune on 27,000 reasoning samples over 50 conditions. About 3.6 GB peak RAM. | Top-1 80 % on 10 cases; calibration error 0.275. Feasibility only. | [arXiv 2607.24814](https://arxiv.org/abs/2607.24814) |
| Aerospace medicine board questions | GPT-4, Gemini Advanced and a RAG model on 20 questions. | 70 %, 55 %, **85 % (RAG)**. Harmful factual gaps and inconsistency found. | Anderson et al., [Wilderness Environ Med 2025](https://digitalscholar.lsuhsc.edu/som_facpubs/3789) |

## 4. The common pattern

Every serious effort uses the same parts:

1. **Open-weight model on local hardware.** Cloud prototypes come first; offline is a later port (for CMO-DA, about 10 months between the public announcements). Small models (3–4B) fit phones; 20–30B models need a laptop-class GPU or more.
2. **Grounding in an approved source**: spaceflight literature and UpToDate (NASA), national clinical guidelines (Uganda), RAG (the board-question study, where RAG scored best).
3. **The model supports a human; it does not decide.** Every source says this. Uganda removes dose output. NASA says the CDSS supports the CMO and must run with backup.
4. **Multi-modal input**: ultrasound with AI guidance, photos, speech, wearables.
5. **Evaluation by clinicians on scenarios** (OSCE-style grading), not benchmarks alone.

## 5. Gaps nobody has closed

- **No published accuracy for an offline space-medicine model.** CMO-DA offline has no metrics; its cloud numbers come from 3 scenarios.
- **No flight test.** CMO-DA runs on a ground twin. Space Llama flew, but not for medicine.
- **Compute.** Onboard GPUs are old and small (T4 class on the ISS, *verify*). Phone deployments hit RAM limits.
- **Hallucination and calibration.** Only Uganda reports a measured reduction (62 %), with no absolute rate.
- **Knowledge updates without a link** and **trust** are named as needs but have no published solution.
- **Clinical outcomes.** The largest trial (Kenya, cloud GPT-4o) found better documentation and planning but no significant change in treatment failure.

## 6. What this means for AstroHealth

- **Our design matches NASA's direction.** AstroHealth's LLM proposes and the deterministic engine decides ([ADR 0002](../adr/0002-llm-chooses-within-approved-pathways.md), [ADR 0010](../adr/0010-condition-catalog-with-uncatalogued-fallback.md)); actions come only from approved pathways; the no-LLM fallback is the "reliable backup" the EIMO meetings ask for. Pitch line: NASA moved CMO-DA from cloud to offline in 2026; AstroHealth does the same step on a laptop, and its guardrails let the offline model fail safely.
- **Milestone 2 candidates.** Add **MedGemma 27B** (text, medical tuning) next to gpt-oss-20b and Qwen3 14B. It fits the 48 GB MacBook at 4-bit. ADR 0004 says tool calling matters more than medical tuning, and MedGemma's tool-calling support is not confirmed *(verify)*, so the harness decides. MedGemma 4B is the option if a smaller device is needed. gpt-oss-20b has published HealthBench numbers, which help the pitch.
- **Runtime.** Keep Ollama ([ADR 0006](../adr/0006-node-backend-with-ai-sdk-gateway.md)). RamaLama is the runtime NASA tests and can pull Ollama models, but switching adds no demo value. Mention it as a deployment path only.
- **Evaluation.** The ADR 0004 criteria already go beyond what NASA has published for the offline CMO-DA. An optional addition: score a few runs with an OSCE-style rubric (history, reasoning, plan), as NASA and Google did.
- **Scope.** Do not add vision models, ultrasound guidance or robotics. They are NASA's next steps, not the hackathon MVP.
- **Honesty in the pitch.** Say that no offline medical model has flight-validated accuracy, including ours. Every number shown from this doc needs its source link (project rule).
