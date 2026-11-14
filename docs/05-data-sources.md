# 05 — Data source inventory (NASA + other space agencies)

**Data only.** Knowledge sources (risk pages, standards, papers) are in [02-resources.md](02-resources.md).
✅ = we opened it or called it ourselves · ☑️ = confirmed from the provider's own page or API metadata but not downloaded · ⚠️ = secondary source, verify before relying on it.

## What the challenge's Resources tab links to

[Resources tab](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/?tab=resources) has **5 links and no datasets**:

| Link | What it is |
|---|---|
| [NASA HRP — Hazards](https://www.nasa.gov/hrp/hazards/) | The 5 hazards (RIDGE) |
| [NASA HRP — Risks](https://www.nasa.gov/hrp/risks/) | Risk pages; these link on to Human Research Roadmap evidence reports and OCHMO briefs |
| [NASA HRP — Ongoing research](https://www.nasa.gov/hrp/ongoing-hrp-research/) | Current studies (CHAPEA, HERA, Artemis) |
| [CSA — Monitoring radiation and astronaut health (2026-02-26)](https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp) | Article; no data download |
| [CSA — Why we do science in space](https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp) | Article; no data download |

We followed every link two levels deep (58 pages). The only direct data link is on the [microbes risk page](https://www.nasa.gov/reference/risk-of-host-microorganism-interactions/) ("community of microbes" → `data.nasa.gov/w/kcvb-ngvf`), and **it's dead (404)**: data.nasa.gov moved to CKAN. The same ISS microbe data is on OSDR (see below). Everything else points to portals (NLSP, OSDR, LSDA, Human Research Roadmap). The real datasets below are what those portals hold.

## Tiers at a glance

| Tier | Meaning | Hackathon use |
|---|---|---|
| **1. Open now** | Download or call with no account | Use directly in the app |
| **2. Free sign-up** | Free API key or account | Use, sign up early |
| **3. Catalog open, data on request** | Can browse what was measured; data needs an approved request (weeks) | Use the variable lists to choose indicators; don't wait for the data |
| **4. Not public** | Prior art or private | Cite only |

---

## Tier 1 — Open now

### NASA OSDR (Open Science Data Repository) — real human data ✅
Portal: <https://osdr.nasa.gov/bio/repo> · API: <https://www.nasa.gov/osdr-api> · Bulk: `aws s3 ls --no-sign-request s3://nasa-osdr/`
A search for `organism = Homo sapiens` returns **121 studies** (most are cell cultures or radiation exposures in the lab). The ones that matter for crew health:

| Study | What's in it | Why it matters to us |
|---|---|---|
| **[OSD-575](https://osdr.nasa.gov/bio/repo/data/studies/OSD-575)** Inspiration4 serum ✅ | **Comprehensive metabolic panel** (glucose, BUN, creatinine, eGFR, sodium, potassium, chloride, CO2, **calcium**, protein, albumin, bilirubin, ALP, AST, ALT) + **cardiovascular** and immune cytokine panels. CSV files | **Actual clinical labs from 4 civilian astronauts**, each with lab reference ranges (`RANGE_MIN`, `RANGE_MAX`) |
| **[OSD-569](https://osdr.nasa.gov/bio/repo/data/studies/OSD-569)** Inspiration4 whole blood ✅ | **Complete blood count** (WBC, RBC, hemoglobin, hematocrit, platelets, neutrophils, lymphocytes, etc.) + RNA-seq, genome sequencing | Real CBC trajectories (immune and anemia indicators) |
| **[OSD-656](https://osdr.nasa.gov/bio/repo/data/studies/OSD-656)** Inspiration4 urine ✅ | Urine inflammation panel (~200 proteins) | Urine as a non-invasive in-flight sample |
| OSD-[570](https://osdr.nasa.gov/bio/repo/data/studies/OSD-570) / [571](https://osdr.nasa.gov/bio/repo/data/studies/OSD-571) / [572](https://osdr.nasa.gov/bio/repo/data/studies/OSD-572) / [573](https://osdr.nasa.gov/bio/repo/data/studies/OSD-573) / [574](https://osdr.nasa.gov/bio/repo/data/studies/OSD-574) / [630](https://osdr.nasa.gov/bio/repo/data/studies/OSD-630) / [687](https://osdr.nasa.gov/bio/repo/data/studies/OSD-687) | Immune cells (PBMC), plasma omics, microbiome swabs (body and capsule), skin, stool, T-cell epigenetics | Deeper biology; probably too deep for the UI |
| OSD-[903](https://osdr.nasa.gov/bio/repo/data/studies/OSD-903) / [943](https://osdr.nasa.gov/bio/repo/data/studies/OSD-943) | Longitudinal transcriptomic and epigenetic immune response in astronauts (search for "Axiom" returns these) | Immune trend over a mission |
| OSD-[53](https://osdr.nasa.gov/bio/repo/data/studies/OSD-53), [174](https://osdr.nasa.gov/bio/repo/data/studies/OSD-174), [481](https://osdr.nasa.gov/bio/repo/data/studies/OSD-481), [483](https://osdr.nasa.gov/bio/repo/data/studies/OSD-483), [484](https://osdr.nasa.gov/bio/repo/data/studies/OSD-484) | Older astronaut gene expression (incl. JAXA hair-follicle study OSD-174) | Background |
| OSD-[195](https://osdr.nasa.gov/bio/repo/data/studies/OSD-195), [198](https://osdr.nasa.gov/bio/repo/data/studies/OSD-198), [370](https://osdr.nasa.gov/bio/repo/data/studies/OSD-370), [51](https://osdr.nasa.gov/bio/repo/data/studies/OSD-51), [942](https://osdr.nasa.gov/bio/repo/data/studies/OSD-942), [946](https://osdr.nasa.gov/bio/repo/data/studies/OSD-946) | **Bed-rest** muscle gene expression (21–60 days of head-down tilt) | Analog for muscle loss |
| OSD-[140](https://osdr.nasa.gov/bio/repo/data/studies/OSD-140) | **Mars-500** 520-day isolation epigenetics | Isolation analog |
| OSD-[353](https://osdr.nasa.gov/bio/repo/data/studies/OSD-353) | Plasma proteome in real missions + ground analogs | Biomarkers |
| **OSD-[280](https://osdr.nasa.gov/bio/repo/data/studies/OSD-280)** ☑️ | Astronaut **salivary microbiome** | Saliva as a non-invasive sample |
| **ISS Microbial Observatory** OSD-[64](https://osdr.nasa.gov/bio/repo/data/studies/OSD-64) / [65](https://osdr.nasa.gov/bio/repo/data/studies/OSD-65) / [66](https://osdr.nasa.gov/bio/repo/data/studies/OSD-66) / [252](https://osdr.nasa.gov/bio/repo/data/studies/OSD-252) / [303](https://osdr.nasa.gov/bio/repo/data/studies/OSD-303) / [361](https://osdr.nasa.gov/bio/repo/data/studies/OSD-361) / [400](https://osdr.nasa.gov/bio/repo/data/studies/OSD-400) ☑️ | Microbes on ISS surfaces and in the air, over several flights. Replaces the dead data.nasa.gov link on the microbes risk page | Cabin contamination indicator |
| **SANS ex vivo** OSD-[815](https://osdr.nasa.gov/bio/repo/data/studies/OSD-815) / [816](https://osdr.nasa.gov/bio/repo/data/studies/OSD-816) / [817](https://osdr.nasa.gov/bio/repo/data/studies/OSD-817) / [818](https://osdr.nasa.gov/bio/repo/data/studies/OSD-818) ☑️ | Human eye-tissue studies modelling spaceflight eye swelling | Background for an eye card |
| Rodent **bone and muscle** phenotypes: OSD-[467](https://osdr.nasa.gov/bio/repo/data/studies/OSD-467) / [471](https://osdr.nasa.gov/bio/repo/data/studies/OSD-471) / [477](https://osdr.nasa.gov/bio/repo/data/studies/OSD-477) / [488](https://osdr.nasa.gov/bio/repo/data/studies/OSD-488) / [489](https://osdr.nasa.gov/bio/repo/data/studies/OSD-489) / [608](https://osdr.nasa.gov/bio/repo/data/studies/OSD-608) / [653](https://osdr.nasa.gov/bio/repo/data/studies/OSD-653) / [654](https://osdr.nasa.gov/bio/repo/data/studies/OSD-654) / [660](https://osdr.nasa.gov/bio/repo/data/studies/OSD-660) / [661](https://osdr.nasa.gov/bio/repo/data/studies/OSD-661) / [662](https://osdr.nasa.gov/bio/repo/data/studies/OSD-662) / [663](https://osdr.nasa.gov/bio/repo/data/studies/OSD-663) / [804](https://osdr.nasa.gov/bio/repo/data/studies/OSD-804) / [980](https://osdr.nasa.gov/bio/repo/data/studies/OSD-980) ☑️ | Bone density, micro-CT, muscle mass and strength from mice flown on ISS or in hindlimb unloading | Real tabular bone/muscle loss numbers, **but in mice** (no open human in-flight bone data) |

Search used: `https://osdr.nasa.gov/osdr/data/search?term=<word>&type=cgene,alsda` ([example](https://osdr.nasa.gov/osdr/data/search?term=inspiration4&type=cgene)) · file lists: `https://osdr.nasa.gov/osdr/data/osd/files/<N>` ([example](https://osdr.nasa.gov/osdr/data/osd/files/575)) · study page: `https://osdr.nasa.gov/bio/repo/data/studies/OSD-<N>`

**File format we confirmed (OSD-575 CMP):**
```
ANALYTE,VALUE,RANGE_MIN,RANGE_MAX,UNITS,TEST_TYPE,SUBJECT_ID,SEX,timepoint
GLUCOSE,83,65,99,mg/dL,CMP,C001,M,L-92
CALCIUM,9.7,8.6,10.3,mg/dL,CMP,C001,M,L-92
```
Subjects `C001`–`C004`. Timepoints: **L-92, L-44, L-3** (days before launch) and **R+1, R+45, R+82, R+194** (days after return). No in-flight blood draws for these panels (3-day mission).
Download pattern: `https://osdr.nasa.gov/geode-py/ws/studies/OSD-575/download?source=datamanager&file=<file name>`
Files: `LSDS-8_Comprehensive_Metabolic_Panel_CMP.upload_SUBMITTED.csv`, `LSDS-8_Multiplex_serum.cardiovascular.EvePanel_SUBMITTED.csv`, `LSDS-7_Complete_Blood_Count_CBC.upload_SUBMITTED.csv` (OSD-569), plus `_TRANSFORMED` versions.
Cite as: *"Data are courtesy of the NASA Open Science Data Repository (https://osdr.nasa.gov/bio/repo)."* Raw human sequence data is controlled (needs an application). The processed files above are open.

### NASA Life Sciences Portal — public flight and analog data ☑️
<https://nlsp.nasa.gov/explore> · <https://www.nasa.gov/hrp/nlsp/>
We pulled all 2,676 experiment records from the NLSP API:
- **306 experiments are fully public, 156 partly public.** 288 of them are human studies.
- Of those 288: **184 have machine-readable files** (CSV / XLS / XLSX / TXT), 83 have only PDF or TIFF scans, 21 have no files.
- About **94 machine-readable human sets** match our health indicators. They span Apollo, Skylab, Shuttle, Mir, ISS and ground analogs (bed rest, NEEMO undersea, Antarctic).
- Caveat: older Shuttle and Mir data is often scanned tables (TIFF/PDF) next to a small spreadsheet. Open the file before planning around it.

API (no key):
- List: `https://nlsp.nasa.gov/api/v1/data/experiments?limit=200&page=N` — the `archive_status` field says public vs on request.
- One experiment: `https://nlsp.nasa.gov/api/v1/data/experiments/<id>/full` — `related.datasets[].children[]` gives each file's `key`, name and extension.
- Download a file, **no login** ✅: `https://nlsp.nasa.gov/api/v1/files/<key>/download`. Tested on a Shuttle 178066 xlsx (200 OK, 11.8 KB): [example record](https://nlsp.nasa.gov/api/v1/data/experiments/ff0398fd-0abc-589d-883c-7e55aa73831c/full), [example file](https://nlsp.nasa.gov/api/v1/files/65b45351-268a-5348-9b4f-1ae9fa38850c/download).
- Page: `https://nlsp.nasa.gov/explore/data/details/<id>?dataType=EXPERIMENTS` ([example](https://nlsp.nasa.gov/explore/data/details/ff0398fd-0abc-589d-883c-7e55aa73831c?dataType=EXPERIMENTS))

**Key public sets with machine-readable files** (we read file lists from the API; we didn't open the files):

| Experiment | Platform | What | Files | DOI |
|---|---|---|---|---|
| **96-E096** Crew and crew-ground interactions | ISS | Mood, fatigue, team questionnaires | 11 xlsx, 2 xls | [10.83263/y1m7-r036](https://doi.org/10.83263/y1m7-r036) |
| **96-E044** EVA and pulmonary function | ISS | Lung function before/after spacewalks | 9 xls | [10.83263/7nhp-yt75](https://doi.org/10.83263/7nhp-yt75) |
| **96-E094** Dosimetric mapping | ISS | Radiation dose around the station | 9 xls, 17 tif | [10.83263/vys1-6526](https://doi.org/10.83263/vys1-6526) |
| **178066** In-flight cardiovascular deconditioning | Shuttle | In-flight cardiovascular data | 2 xlsx, 7 tif | [10.83263/d8e9-0785](https://doi.org/10.83263/d8e9-0785) |
| **DSO 484** Circadian shifting by bright light | Shuttle | Circadian / sleep | 1 xls, 4 tif | [10.83263/dqtx-da40](https://doi.org/10.83263/dqtx-da40) |
| **9307570** COIS | Shuttle | Vestibular / sensorimotor | 1 xls | [10.83263/j9pa-hq45](https://doi.org/10.83263/j9pa-hq45) |
| **3.1.2** Orthostatic intolerance, ambulatory monitoring | Mir | 24-h blood pressure and ECG | 1 xlsx | [10.83263/y1ag-4x65](https://doi.org/10.83263/y1ag-4x65) |
| **9401663** Sleep and vestibular adaptation | Mir | Sleep | 1 xls | [10.83263/5cxh-7f44](https://doi.org/10.83263/5cxh-7f44) |
| **9401628** Crew and crew-ground interactions | Mir | Mood | 3 xls, 6 tif | [10.83263/c22r-2042](https://doi.org/10.83263/c22r-2042) |
| **LSAHNEWSV7_2_1** Body mass changes | Mir | Body mass over missions | 14 xls | [10.83263/rx8d-2h34](https://doi.org/10.83263/rx8d-2h34) |
| **skych** Skylab crew health | Skylab | Crew health log | 2 xlsx | [10.83263/98ax-4f77](https://doi.org/10.83263/98ax-4f77) |
| **NEEMO-PHYS** Physiologic monitoring | Undersea analog | BP, heart rate, SpO2 | 1 xls | [10.83263/zm3e-9g10](https://doi.org/10.83263/zm3e-9g10) |
| **NEEMO-ACTIWATCH** Actigraphy | Undersea analog | Sleep and activity | 1 xls | [10.83263/skft-eh56](https://doi.org/10.83263/skft-eh56) |
| **BRSMCF** Bed Rest Standard Measures: cardiovascular | Bed rest | Cardiovascular | 5 csv | [10.83263/kw2c-zj80](https://doi.org/10.83263/kw2c-zj80) |
| **BRSMImmune** Bed Rest Standard Measures: immunity | Bed rest | Immune | 22 csv | [10.83263/75we-ch31](https://doi.org/10.83263/75we-ch31) |
| **MR080G** Aerobic capacity (flight analog) | Bed rest | VO2 / fitness | 723 csv, 252 txt | [10.83263/w056-8t76](https://doi.org/10.83263/w056-8t76) |
| **MR016G** Clinical nutrition (flight analog) | Bed rest | Nutrition blood panel | 7 csv | [10.83263/r8re-xs50](https://doi.org/10.83263/r8re-xs50) |
| **LSAHNEWS** series (~20 sets) | Astronaut corps | Summary tables: EVA physiology, blood parameters of first-time Shuttle flyers, visual acuity, bone health, hypertension | xls | e.g. [10.83263/k583-w096](https://doi.org/10.83263/k583-w096), [10.83263/j8qt-vv45](https://doi.org/10.83263/j8qt-vv45) |

Also public: **UTMB bed-rest Campaigns 1, 3 and 11** ("all datasets are publicly available"). Campaign 1 = 3 men, 10 days ambulatory → **60 days of 6° head-down tilt** → 14 days recovery. Measures: hepatic and renal function, vascular function, functional mobility, Actilight (activity/light), WinSCAT cognition, tilt response, posturography. Links: [Campaign 1](https://nlsp.nasa.gov/explore/data/details/6eaf1654-72d4-5d71-a9dd-a02e674c6473?dataType=MISSIONS) · [Campaign 3](https://nlsp.nasa.gov/explore/data/details/593a6726-8650-551a-8d67-0f03468de92f?dataType=MISSIONS) · [Campaign 11](https://nlsp.nasa.gov/explore/data/details/8e583564-d124-58ce-b44a-a16bb5b5d981?dataType=MISSIONS).

**Still on request:** the ISS [**Spaceflight Standard Measures**](https://nlsp.nasa.gov/resources/standard-measures) (`SSM_*`, ongoing collection) and ESA :envihab bed-rest Standard Measures (`ESA_BRSM_*`: VaPER, AGBRESA, SANS_CM).

### Measured radiation dose: ISS, deep space, Mars orbit ✅
| Source | What | Access |
|---|---|---|
| **ISS TEPC** (tissue-equivalent proportional counter) ✅ | ISS crew-cabin dose, **1-minute cadence, 2010–2018**, in µGy/min (absorbed) and µSv/min (dose equivalent), with ISS position. During the 2017-09-10 solar particle event we saw **413.8 µGy and 889.2 µSv for the day, peak 17.58 µGy/min** | [CDAWeb](https://cdaweb.gsfc.nasa.gov/) HAPI, no key: [dataset info](https://cdaweb.gsfc.nasa.gov/hapi/info?id=ISS_DOSANL_TEPC) · [2017-09-10 storm as CSV](https://cdaweb.gsfc.nasa.gov/hapi/data?id=ISS_DOSANL_TEPC&time.min=2017-09-10T00:00Z&time.max=2017-09-11T00:00Z&format=csv) |
| **BioSentinel** LET spectrometer ☑️ | Dose and LET (radiation quality) **in deep space beyond the Moon, 2022-11 → 2025-11** | CDAWeb HAPI, id `BIOSENTINEL_LET_LETS`: [dataset info](https://cdaweb.gsfc.nasa.gov/hapi/info?id=BIOSENTINEL_LET_LETS) |
| **ExoMars TGO Liulin-MO** (ESA–Roscosmos, part of the FREND instrument) ✅ | Dose rate and particle flux **in Mars orbit**, in 2 perpendicular directions. **Hourly calibrated files, 2016-05 → 2025-12**: columns `utc_time`, flux (particles/cm²/s) and dose rate (µGy/h, in silicon). A month is a ~20 KB zip, **no login needed**. In the file we opened, dose went from ~5.5 to ~19 µGy/h on 2025-12-01 (looks like a solar particle event; we haven't checked that against DONKI) | [ESA PSA](https://psa.esa.int) TAP: `https://psa.esa.int/psa-tap/tap/sync` with `QUERY=SELECT … FROM epn_core WHERE instrument_name='FREND'` ([example: 5 hourly files](https://psa.esa.int/psa-tap/tap/sync?REQUEST=doQuery&LANG=ADQL&FORMAT=csv&QUERY=SELECT%20TOP%205%20granule_uid,access_url%20FROM%20epn_core%20WHERE%20instrument_name='FREND'%20AND%20granule_uid%20LIKE%20'%25cal_sc_dh%25')). Each row's `access_url` downloads the product. Hourly files are `frd_cal_sc_dh_*` (`dm_*` is a larger file we didn't open). Archive guide (ICD, login needed): `EXM-FR-ICD-IKI-0086` |

These three plus Curiosity RAD (below) give **measured** dose for every mission phase: ISS orbit, deep-space transit, Mars orbit and Mars surface.

### Space weather — real radiation events ✅
| Source | Endpoint | What we confirmed |
|---|---|---|
| **NASA DONKI** | [`https://api.nasa.gov/DONKI/SEP?startDate=…&endDate=…&api_key=DEMO_KEY`](https://api.nasa.gov/DONKI/SEP?startDate=2024-05-01&endDate=2024-05-31&api_key=DEMO_KEY) (also `/FLR`, `/CME`, `/GST`, `/notifications`) | Returns solar energetic particle events (e.g. the May 2024 storms) with linked flares and alerts. `DEMO_KEY` works but is rate-limited; get a free key (Tier 2) |
| **NOAA SWPC** | <https://services.swpc.noaa.gov/json/goes/primary/integral-protons-1-day.json> | Live GOES proton flux (≥1, ≥10, ≥100 MeV), 5-min cadence. ≥10 MeV is the standard "radiation storm" channel |
| NOAA SWPC alerts | <https://services.swpc.noaa.gov/products/alerts.json> | Live text alerts and warnings |
| NASA CCMC iSWA | <https://iswa.gsfc.nasa.gov> ☑️ | Quick-look dashboards incl. Curiosity RAD dose rate (quick-look only, not for analysis) |

### Mars and deep-space radiation dose ☑️
- **Curiosity RAD** (Radiation Assessment Detector): calibrated dose rates on Mars' surface. PDS PPI node dataset `MSL-M-RAD-3-RDR-V1.0` ([readme](https://pds-ppi.igpp.ucla.edu/data/MSL-M-RAD-3-RDR-V1.0/AAREADME.TXT)). Gives realistic dose-per-day for a Mars-surface profile.
- **Artemis I** (Orion, 2022): MARE phantoms Helga/Zohar (DLR) and Orion crew radiation sensors. Results are in papers; we didn't find an open raw dataset ⚠️. Same sensors flew on Artemis II.

### Canadian Space Agency open data ☑️
Portal: <https://data.asc-csa.gc.ca> (searched via its API)
- [**Performance Readiness Evaluation Tool (PRET)**](https://data.asc-csa.gc.ca/dataset/c22fa749-b005-4956-bf68-2ac2b9e68d31) — **CSV**. Neurocognitive test results (processing speed, memory, attention, response control) from a Mars-mission VR simulator. Tested during the **Mars-500** isolation study and in Carleton University lab phases. Files: <https://donnees-data.asc-csa.gc.ca/users/OpenData_DonneesOuvertes/pub/PRET/>. **The only open cognitive-readiness dataset from a space agency we found.**
- *Canadian Healthcare in Deep Space* (PDF report) — expert-group view on autonomous medical care. Knowledge, not data.
- No open Bio-Monitor/Astroskin data. CSA is funding analysis of Bio-Monitor data from 9 astronauts (sleep, fitness, BP), but it isn't public.

### JAXA ☑️
- **Area PADLES** — radiation dose measured at 9 spots inside the ISS Kibo module since 2008, results posted on JAXA's *Humans in Space* site ([index](https://humans-in-space.jaxa.jp/spacerad/EI000.html), e.g. [PADLES 1](https://humans-in-space.jaxa.jp/spacerad/EI001_padles1.html)). Realistic ISS dose-rate numbers. Individual crew doses are not public.
- Biological Rhythms 48hrs (Holter ECG + actigraphy): results in papers only.

---

## Tier 2 — Free sign-up

| Source | What | Access |
|---|---|---|
| **NASA API key** | Raises DONKI rate limits | Instant at <https://api.nasa.gov> |
| **ESA HREDA** — <https://hreda.esac.esa.int> | All ESA human and robotic exploration investigations since 1972. Search is anonymous; downloads need a free login (per HREDA, not re-tested). See the ESA section below for what is actually there | Metadata needs no login (TAP); sign up only if we want the Blank Books or cell data |
| **ESA Space Weather Service Network** — <https://swe.ssa.esa.int> | European space-weather data + HAPI API | Free registration; API needs extra machine-to-machine credentials |
| **SPENVIS** (ESA, run by BIRA-IASB) — <https://spenvis.oma.be> | Radiation dose modeling for any orbit or trajectory | Free, but **requires an institutional email** (no Gmail) |

---

## ESA datasets — what's real and open

**Short version:** ESA has **no open human measurement data** we can use. Its open human-research files are data dictionaries. Its real open tabular data is from cells and from radiation instruments.

**[HREDA](https://hreda.esac.esa.int), queried without login** via TAP/ADQL: `https://hreda.esac.esa.int/hreda-sl-tap/tap/sync?REQUEST=doQuery&LANG=ADQL&FORMAT=csv&QUERY=…` ([example: list tables](https://hreda.esac.esa.int/hreda-sl-tap/tap/sync?REQUEST=doQuery&LANG=ADQL&FORMAT=csv&QUERY=SELECT%20TOP%201%20*%20FROM%20tap_schema.tables)) (`CASE WHEN` isn't supported; use `GROUP BY`).

| What | Investigations | What's public |
|---|---|---|
| **Bed-rest studies** | AGBRESA, BRAG, Cocktail, MNX, NUC, MEP, RSL, BRACE 2023 baseline | Only the **"Investigation Data Blank Book"** PDFs: lists of variables, units and timepoints, **no values**. Still useful to choose indicators |
| **ISS human studies** | Airway Monitoring (exhaled NO), Flywheel exercise, SpaceTex (clothing / thermal comfort), AstroMentalHealth, Human Gut Microbiota | Blank Book PDFs only. Gut microbiota sequences are embargoed until **2027-04-23** |
| **ISS cell and tissue studies** | **MicroAge** (CSV, 6.9 GB), **Molecular Muscle** (CSV, 15.7 GB), **PROMETEO** (CSV/XLSX), **T-Cell Act in Aging** (TXT) | Real data files. Muscle ageing and immune biology in cells; too deep for the UI |
| ESA studies listed in NLSP | Circa (24-h BP/HR), Circadian Rhythms, Dreams (EEG sleep), Space Headaches, ESA Active Dosimeter, Matroshka | Marked "held by another repository" or not archived. **No open data found** |
| ESA :envihab bed-rest Standard Measures | VaPER, AGBRESA, SANS_CM | On request (via [NLSP](https://nlsp.nasa.gov/resources/standard-measures)) |

**ESA radiation data that is open:**
- **ExoMars TGO Liulin-MO**, hourly Mars-orbit dose ✅. See the radiation table in Tier 1. **This is ESA's most useful open dataset for us.**
- **Rosetta SREM** ☑️: electron and proton flux during cruise to the comet, 2004–2016, on PDS ([cruise 1 dataset](https://pdssbn.astro.umd.edu/holdings/ro-x-srem-5-cr1-v1.0/)). Interplanetary environment, not dose. Low priority.

---

## Tier 3 — Catalog open, data on request (use for indicator choice)

| Source | What you can see without asking | Why it's still useful |
|---|---|---|
| **NLSP / LSDA** — <https://nlsp.nasa.gov/explore> | **2,676 experiments** (959 human) since 1961, each with its **list of variables measured**, missions, PI. Exportable table. Most data: "privacy-protected, available via data request" | Ready-made list of "what NASA actually measures" per experiment. Example: the ISS spinal ultrasound study lists disc height, muscle cross-section, BMD, exercise duration |
| **Spaceflight Standard Measures** — <https://nlsp.nasa.gov/resources/standard-measures> | NASA's **official core measurement set** by platform: **ISS (9)**: actigraphy, cognition, personality, sleep quality/team questionnaire, biochemistry, carotid intima-media thickness, immune cell profile, microbiome, sensorimotor. **HERA (3)** and Russian **NEK (3)**: PANAS mood scale, General Health Questionnaire, nutrition blood panel. **:envihab bed rest (12)**: bone density, muscle, ocular tests, cardiovascular, sensorimotor, behavioral and more | **The strongest evidence for which indicators to put in the app.** Every "why this measurement?" card can say "NASA collects this from every ISS crew member" |
| **LSAH** — <https://nlsp.nasa.gov/resources/lsah> | Program description, newsletters | Long-term astronaut health context |
| NASA Twins Study, CIPHER, Artemis II (ARCHeR actigraphy, Immune Biomarkers, AVATAR) | Papers / descriptions | Results not published as open data yet ⚠️ |
| ESA bed-rest core data (7 studies) | AO description at <https://scispace.esa.int/research-opportunities/ao-2023-bedrestcoredata/> | Call closed; shows what exists |

---

## Tier 4 — Not public (prior art, cite only)

| Agency | System | Notes |
|---|---|---|
| CNES / ESA | [**EveryWear**](https://cnes.fr/projets/cadmos/everywear) tablet assistant | Closest product to ours; no data |
| CSA | **Bio-Monitor / Astroskin** shirt | ECG, breathing, SpO2, BP, activity, sleep; no open data |
| NASA | ISS medical records, Crew Medical Officer Digital Assistant (CMO-DA) | Private / prototype |
| IBMP (Russia) | Mars-500, SIRIUS | Papers only (plus OSD-140 and PRET above) |
| MBRSC (UAE) | UAE Analog Programme (SIRIUS 2021, HERA 2024: energy use, bone density, muscle mass) | No public data policy found |
| DLR / ESA | DOSIS-3D radiation maps in Columbus | Papers only |

---

## Not from space agencies, but needed to fill gaps ⚠️ (not checked today)

| Source | Use |
|---|---|
| [PhysioNet](https://physionet.org) | Open ECG, PPG, blood pressure and sleep recordings to make vital-sign streams look real |
| [UBFC-rPPG](https://sites.google.com/view/ybenezeth/ubfcrppg) and similar webcam datasets | Testing camera-based heart rate |
| [NHANES (CDC)](https://www.cdc.gov/nchs/nhanes/) | Population reference ranges for vitals and labs |

---

## Coverage: which data category has real data?

Categories from [03-problem-space.md](03-problem-space.md).

| Category | Real space data, open | Analog data, open | Gap → plan |
|---|---|---|---|
| Vital signs (HR, BP, SpO2, temp) | ☑️ Mir 3.1.2 (24-h BP/ECG), Shuttle 178066 (in-flight cardio). Old, small | NEEMO-PHYS (BP, HR, SpO2), bed-rest cardiovascular BRSMCF (NLSP) | Synthetic + PhysioNet waveforms + live webcam HR |
| Blood labs | **✅ Inspiration4 CMP, CBC, cardio panel**; ☑️ LSAH first-time Shuttle flyer blood parameters | Bed-rest hepatic/renal, nutrition MR016G, immunity BRSMImmune (NLSP) | Use real values as baselines |
| Urine | ✅ Inspiration4 urine panel | — | — |
| Lungs | ☑️ ISS 96-E044 pulmonary function after EVA | — | Optional card |
| Imaging / eyes | ✖ (LSAH visual acuity summary only) | SANS ex vivo tissue (OSDR); bed-rest ocular (on request) | Image upload + guided steps |
| Bone / muscle | ✖ in humans; ☑️ **14 rodent studies** in OSDR; Mir body mass (LSAH) | Bed-rest aerobic capacity MR080G, fitness and mobility (NLSP) | Published rate (1–1.5 %/month) + adherence model |
| Sleep / activity | ☑️ Mir 9401663 sleep, Shuttle DSO 484 circadian | NEEMO actigraphy, Actilight (bed rest) | Sleep log + synthetic |
| Cognition / mood | ☑️ **ISS 96-E096** and Mir 9401628 mood/fatigue questionnaires | **CSA PRET (Mars-500)**, WinSCAT (NLSP) | In-browser reaction test + mood scale |
| Radiation | **✅ ISS TEPC (1-min, 2010–2018), BioSentinel deep space, ExoMars TGO Mars orbit, Curiosity RAD Mars surface; DONKI and NOAA live; JAXA PADLES** | — | Real feeds + real historic storm replay |
| Cabin environment (CO2, temp) | ✖ (ISS public telemetry exists, CO2 channel unconfirmed) | — | Simulated cabin + NASA CO2 limits |
| Microbiome | ✅ Inspiration4 swabs; ☑️ OSD-280 saliva; ISS Microbial Observatory surfaces | — | Probably out of scope |
