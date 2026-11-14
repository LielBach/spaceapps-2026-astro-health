# 02 — Resource catalog (NASA, ESA, other agencies)

Legend — **Use:** 🧠 knowledge (what/why/thresholds) · 📊 data we can actually download · 🔌 live API/feed · 🧪 prior art to learn from / cite · 🔒 request-only or private
Items marked *(verify)* came from memory or secondary sources — confirm before citing in the submission.
**For datasets, access tiers and file formats, see [05-data-sources.md](../technical/05-data-sources.md)** (it supersedes the data notes below where they differ).

> **Key reality check:** individual astronaut medical data is private. Almost nothing at the level of "this astronaut's daily BP" is public. Plan on **synthetic data seeded from published effect sizes**, plus **real public feeds** for environment/space weather, plus **live measurements in the demo** (camera, reaction-time tests). Being explicit about this is a strength, not a weakness.

---

## A. Space Apps itself

| Resource | Use | Notes |
|---|---|---|
| [Challenge page](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/) | 🧠 | Brief + objectives |
| Challenge Resources tab (`?tab=resources`) | 🧠📊 | 5 NASA HRP / CSA links, no datasets — see [05-data-sources.md](../technical/05-data-sources.md) |
| [2026 Space Agency Partners](https://www.spaceappschallenge.org/2026/space-agency-partners/) | 🧠 | 17 partners: Angola, Argentina (CONAE), Bahrain, Brazil (AEB), **CSA**, **ESA**, ISRO, ASI, **JAXA**, KASA, Nigeria, Paraguay, Senegal, Spain (AEE), Turkey (TUA), **UAE (MBRSC)**, UK Space Agency |
| [Space Apps Connect](https://github.com/nasa/spaceapps) / [Participant FAQs](https://www.spaceappschallenge.org/resources/participant-faqs/) | — | Rules, submission format |

## B. NASA — knowledge base (what the risks are, and the thresholds)

| Resource | Use | What we get |
|---|---|---|
| [NASA Human Research Program](https://www.nasa.gov/hrp/) | 🧠 | Elements: Human Factors & Behavioral Performance, Human Health Countermeasures, Space Radiation, Research Ops |
| [Five hazards](https://www.nasa.gov/hrp/hazards/) → [radiation](https://www.nasa.gov/hrp/hazard-space-radiation/), [isolation](https://www.nasa.gov/hrp/hazard-isolation-and-confinement/), [distance](https://www.nasa.gov/hrp/hazard-distance-from-earth/), [gravity](https://www.nasa.gov/hrp/hazard-gravity-fields/), [hostile/closed env.](https://www.nasa.gov/hrp/hazard-hostile-closed-environments/) | 🧠 | Top-level framing (RIDGE) |
| [HRP Risks (17 risk pages)](https://www.nasa.gov/hrp/risks/) | 🧠 | Plain-language page per risk: bone, SANS, CV, immune, sleep, behavioral, nutrition, radiation cancer, hypoxia, DCS, EVA, sensorimotor, fitness, microbes, teamwork, systems ops, dynamic loads |
| [Human Research Roadmap](https://humanresearchroadmap.nasa.gov/risks/) | 🧠 | Authoritative list (22 risks incl. **Earth-independent ops**, **celestial dust**, **renal stones**, **ineffective/toxic medications**), knowledge gaps, **evidence reports** (deep dives with numbers) |
| [The Human Body in Space](https://www.nasa.gov/humans-in-space/the-human-body-in-space/) | 🧠 | Readable overview, good for pitch narrative |
| [HRP-funded science FY2024 (PDF)](https://www.nasa.gov/wp-content/uploads/2025/03/final-fy24-hrp-funded-science-002-1.pdf) | 🧠 | Current research directions |
| [NASA-STD-3001 Vol 1 Rev C — Crew Health](https://standards.nasa.gov/sites/default/files/standards/NASA/C//nasa-std-3001-vol-1-rev-c-signature.pdf) | 🧠 | Fitness-for-duty, permissible exposure limits, levels of medical care, **radiation limits** — source for real thresholds |
| [OCHMO standards + technical briefs](https://www.nasa.gov/ochmo/human-spaceflight-and-aviation-standards) | 🧠 | Short PDFs per topic, e.g. [CO2 technical brief](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf) (1-h avg ppCO2 ≤ 3 mmHg) |
| Human Integration Design Handbook (NASA/SP-2010-3407) | 🧠 | **Display/UI design guidance for crew interfaces** — cite it for our UI choices |
| [EIMO ConOps (NTRS, 2024)](https://ntrs.nasa.gov/api/citations/20240001402/downloads/2024_IWS_EIMO_ConOps_FINAL.pdf), [EIMO overview](https://ntrs.nasa.gov/citations/20250000009) | 🧠 | Earth-Independent Medical Operations — the strategic "why" behind our tool |
| [ISS medical events epidemiology (IMM, NTRS)](https://ntrs.nasa.gov/citations/20160012380) | 🧠 | 37 astronauts, 16.75 person-years; in-flight data **relies heavily on self-report**; event rates (congestion, skin, herpes, etc.) |
| [CIPHER](https://www.nasa.gov/cipher/) / Spaceflight Standard Measures | 🧠 | Which measurements NASA actually standardizes across crews |
| [Artemis II crew research](https://www.nasa.gov/general/artemis-ii-crew-both-subjects-and-scientists-in-nasa-deep-space-research) | 🧠 | ARCHeR, Immune Biomarkers, AVATAR — deep-space monitoring state of the art |
| [CMO-DA (Google + NASA)](https://publicsector.google/ai/how-google-and-nasa-are-testing-ai-for-medical-care-in-space/) | 🧪 | AI decision support prototype — closest "competitor"; differentiate from it |
| [TRISH](https://www.nasa.gov/hrp/the-translational-research-institute-for-space-health-trish/) | 🧠🧪 | Translational Research Institute for Space Health; funds exactly this kind of tech; commercial-astronaut data efforts *(verify EXPAND program status)* |
| [NTRS](https://ntrs.nasa.gov) | 🧠 | Search engine for every NASA tech report; use for numbers |

## C. NASA — data you can actually touch

| Resource | Use | Access | What's inside |
|---|---|---|---|
| [NASA Life Sciences Portal (NLSP)](https://www.nasa.gov/hrp/nlsp/) — LSDA | 📊🔒 | Mostly request + approval (IRB), de-identified/aggregated | Human spaceflight & analog studies since 1961 |
| [Lifetime Surveillance of Astronaut Health (LSAH)](https://nlsp.nasa.gov/explore/lsdahome/lsahhome) | 🧠🔒 | Request-only; newsletters/summaries public | Occupational surveillance of astronauts |
| [OSDR — Open Science Data Repository](https://osdr.nasa.gov/bio/repo) | 📊 | Open (human raw data controlled, dbGaP-style) | GeneLab + **ALSDA** (physiology, phenotype, imaging, behavior, environmental telemetry). Mostly rodents/cells/plants; **Inspiration4** human processed data is open |
| [OSDR API](https://www.nasa.gov/osdr-api) + AWS `aws s3 ls --no-sign-request s3://nasa-osdr/` ([registry](https://registry.opendata.aws/nasa-osdr/)) | 🔌📊 | Open | Programmatic metadata + files |
| [SOMA browser (Space Omics & Medical Atlas)](https://soma.weill.cornell.edu/apps/SOMA_Browser/) + [code](https://github.com/eliah-o/inspiration4-omics) | 📊 | Open | Inspiration4 (+ Polaris Dawn, Axiom per portal) multi-omics, blood, urine, cytokines, pre/in/post flight timepoints |
| [NASA DONKI (space weather DB) via api.nasa.gov](https://api.nasa.gov) | 🔌 | Free API key | Solar flares, **solar energetic particle (SEP) events**, CMEs → drive real "radiation storm → shelter" alerts |
| [NOAA SWPC JSON feeds](https://www.swpc.noaa.gov) (GOES proton flux) | 🔌 | Open | Real-time proton flux — same purpose as DONKI, live |
| Curiosity **RAD** dataset (NASA Planetary Data System, PPI node) | 📊 | Open *(verify path)* | Measured radiation dose in Mars cruise & on Mars surface → realistic Mars dose curves |
| ISS public telemetry (ISS Live / Lightstreamer; see "ISS Mimic" open-source project) | 🔌 | Open *(verify ppCO2 channel)* | Cabin pressure/temperature, possibly ppCO2 → real environment feed |
| [data.nasa.gov](https://data.nasa.gov) | 📊 | Open | Catch-all catalog; search "astronaut", "LSDA" |

## D. ESA

| Resource | Use | Notes |
|---|---|---|
| [ESA Human & Robotic Exploration](https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration) | 🧠 | Missions, space medicine stories, European astronaut experiments |
| [HREDA — Human & Robotic Exploration Data Archive](https://hreda.esac.esa.int/hreda-help/about/index.html) | 📊🧠 | Successor (2020) to the Erasmus Experiment Archive; experiment descriptions, some results/data |
| [ESA SciSpacE](https://scispace.esa.int) / [Bed Rest Core Data AO](https://scispace.esa.int/research-opportunities/ao-2023-bedrestcoredata/) | 📊🔒 | Core data from 7 ESA bed-rest studies (head-down tilt = microgravity analog). AO closed; shows what data exists |
| [ESA Exploration Science](https://explorationscience.esa.int) | 🧠 | Lunar/Mars exploration science priorities |
| **EveryWear** (CNES/MEDES, used by ESA crews) — [ESA](https://www.esa.int/ESA_Multimedia/Images/2016/12/EveryWear), [CNES](https://cnes.fr/projets/cadmos/everywear) | 🧪⭐ | **Closest real-world analog of our product**: tablet "personal assistant" on ISS since 2016 — wearables (tonometer, ECG shirt, skin-temp patch), food barcode nutrition logging, data to ESA flight surgeons. Study it, cite it, go beyond it |
| Concordia (Antarctica) & Mars-500 / SIRIUS isolation analogs | 🧠 | Behavioral health, sleep, isolation evidence |
| ESA Space Weather Service Network (swe.ssa.esa.int) | 🔌 | European space-weather alerts *(verify access)* |

## E. Other agencies

| Agency | Resource | Use | Notes |
|---|---|---|---|
| **CSA (Canada)** | [Bio-Monitor / Astroskin](https://www.canada.ca/en/space-agency/news/2016/10/new-advances-innovative-health-technology-tested-space.html) | 🧪 | Smart shirt on ISS since 2018: ECG, HR, breathing rate, SpO2, BP, activity, sleep. Also tested in NASA HERA analog. No public dataset found |
| CSA | "Vascular Echo" / "Vascular Aging" ISS studies; CSA deep-space healthcare program *(verify "Health Beyond")* | 🧠 | Arterial stiffening in space; Canada's push for autonomous medical care |
| CSA | open.canada.ca | 📊 | Search CSA health datasets *(verify)* |
| **JAXA** | [Biological Rhythms 48hrs](https://humans-in-space.jaxa.jp/en/biz-lab/experiment/theme/detail/000917.html) + papers ([Sci Rep 2023](https://www.nature.com/articles/s41598-023-36389-6.pdf)) | 🧠 | 48-h Holter ECG + 96-h actigraphy on 10–21 astronauts: circadian HR/HRV changes, sleep link — good evidence for HRV/sleep indicators |
| **CNES (France)** | EveryWear, MEDES (space clinic, bed rest) | 🧪 | See ESA section |
| **DLR (Germany)** | :envihab; AGBRESA (NASA/ESA/DLR artificial-gravity bed rest) | 🧠 | Countermeasure evidence |
| **IBMP (Russia)** | Mars-500, SIRIUS | 🧠 | Long isolation, crew behavior |
| **MBRSC (UAE)** | AlNeyadi 6-month ISS experiments; UAE analog program | 🧠 | Partner this year — nice to reference |
| **ISRO** | Gaganyaan human spaceflight program | 🧠 | Partner; emerging crew health program |

## F. Non-agency but essential

| Resource | Use | Notes |
|---|---|---|
| [PhysioNet](https://physionet.org) | 📊 | Open ECG, PPG, BP, sleep datasets — realistic waveforms to animate the demo; ground-truth for signal processing |
| NASA Twins Study (Garrett-Bakelman et al., *Science* 2019) | 🧠 | One-year mission, multi-system changes |
| Inspiration4 / SOMA Nature package (June 2024, 44 papers) | 🧠 | Short-duration civilian crew changes |
| Barger et al., *Lancet Neurology* 2014 (sleep on Shuttle/ISS) | 🧠 | ~6 h sleep/night in flight; frequent hypnotic use *(verify numbers)* |
| Marshall-Goebel et al., *JAMA Netw Open* 2019 (jugular venous flow) | 🧠 | Stagnant/reverse flow in ~half of 11 ISS crew, one occlusive thrombus *(verify)* |
| Law et al. 2014 (ISS CO2 vs headache) | 🧠 | CO2 ↔ headache dose-response |
| Mehta et al. (herpesvirus shedding in astronauts) | 🧠 | Latent virus reactivation ~half of crew *(verify)* |
| Hassler et al. *Science* 2014; Zeitlin et al. *Science* 2013 (Curiosity RAD) | 🧠 | Mars surface ≈ 0.64 mSv/day; cruise ≈ 1.8 mSv/day *(verify)* |
| Basner et al. (NASA Cognition battery; HERA cognition study, [Front Physiol 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7198903/)) | 🧠 | Validated short cognitive tests incl. **PVT** — we can implement a PVT in-browser |
