# CLAUDE.md — context for Claude working on this repo

## Project
NASA Space Apps 2026 hackathon entry for "Create Health Monitoring Software for Astronauts on Space Missions". Working name **AstroHealth**. Direction: the closed loop in `docs/product/06-astrohealth-concept.md`, which replaces the 04 MVP (`docs/adr/0001`). Design decisions are in `docs/adr/`, domain terms in `GLOSSARY.md`; use the glossary terms.

## Read first
- Docs are split: `docs/product/` (brief, domain knowledge, directions) and `docs/technical/` (data, architecture, technical designs). New technical designs go in `docs/technical/`.
- `docs/product/01-challenge-brief.md` — the brief; the five questions every indicator must answer (how measured / why / hazard effect / when crew vs ground / action).
- `docs/product/03-problem-space.md` — the hazard→risk→indicator→action table is the domain model. Problems P1–P11 are referenced by ID in other docs.
- `docs/product/02-resources.md` — where every fact comes from (knowledge sources).
- `docs/technical/10-medical-data-standards.md` — the standards that apply (FHIR R4, LOINC, SNOMED CT, ICD-10-CM, UCUM, IEEE 11073, NASA-STD-3001) and the coded measurement interface (ADR 0011). New medical data uses registry codes and UCUM units; never invent a code — use a local code with an explicit mapping.
- `docs/technical/05-data-sources.md` — datasets by access tier, with download URLs and confirmed file formats. Real open human data = Inspiration4 labs on OSDR (OSD-575, OSD-569, OSD-656) and ~94 public NLSP sets (old ISS/Shuttle/Mir flight data, bed rest, NEEMO). Measured radiation dose: ISS TEPC + BioSentinel (CDAWeb HAPI), ExoMars TGO Liulin-MO (ESA PSA TAP), Curiosity RAD. ESA has no open human measurements (HREDA gives data dictionaries only).

## Rules for working here
- **Every threshold or number shown in the UI must carry a source link** (HRP risk page, NASA-STD-3001, OCHMO brief, or paper). Items marked *(verify)* in docs are not yet confirmed; verify before using in UI or pitch.
- Present the app as **decision support**: it shows ranked *suspected* diagnoses for crew medical officer confirmation, and actions come only from approved pathways (`docs/adr/0005`). It never prescribes medication or doses.
- Real astronaut medical data is private. Use: synthetic crew data seeded from published effect sizes, real public feeds (NASA DONKI via api.nasa.gov, NOAA SWPC), PhysioNet waveforms, and live in-browser measurements. Be explicit about which is which.
- Hackathon scope: the MVP is the closed loop in `docs/product/06-astrohealth-concept.md` with the demo case being defined in `docs/product/07`–`08`. Push back on scope creep.
- Must work offline in principle (Mars has no live link) — any LLM/network feature needs a fallback.

## Git workflow
- Always work on a feature branch. Never commit directly to `main`.
- When a piece of work is done, commit it and push the branch without waiting to be asked.
- Then open a PR against `main` and send the PR link to the user for review.
- If the push or the PR fails (for example, an auth error), report the exact error and stop. Do not work around it.

## Key sources (quick links)
- HRP: https://www.nasa.gov/hrp/ · risks: https://www.nasa.gov/hrp/risks/ · roadmap: https://humanresearchroadmap.nasa.gov/risks/
- NASA-STD-3001 Vol 1 Rev C: https://standards.nasa.gov/sites/default/files/standards/NASA/C//nasa-std-3001-vol-1-rev-c-signature.pdf
- OCHMO briefs: https://www.nasa.gov/ochmo/human-spaceflight-and-aviation-standards
- OSDR: https://osdr.nasa.gov/bio/repo · API: https://www.nasa.gov/osdr-api
- DONKI / NASA APIs: https://api.nasa.gov
- ESA HREDA: https://hreda.esac.esa.int · EveryWear (prior art): https://cnes.fr/projets/cadmos/everywear
- Challenge page renders client-side; WebFetch fails on it (SSL) — use the browser tool.
