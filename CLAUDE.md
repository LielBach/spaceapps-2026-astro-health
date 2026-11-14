# CLAUDE.md — context for Claude working on this repo

## Project
NASA Space Apps 2026 hackathon entry for "Create Health Monitoring Software for Astronauts on Space Missions". Working name **BASELINE** (not final). Direction proposed in `docs/04-directions.md` — **not yet confirmed by the team**; check README "Status" before assuming.

## Read first
- `docs/01-challenge-brief.md` — the brief; the five questions every indicator must answer (how measured / why / hazard effect / when crew vs ground / action).
- `docs/03-problem-space.md` — the hazard→risk→indicator→action table is the domain model. Problems P1–P11 are referenced by ID in other docs.
- `docs/02-resources.md` — where every fact comes from (knowledge sources).
- `docs/05-data-sources.md` — datasets by access tier, with download URLs and confirmed file formats. Real open human data = Inspiration4 labs on OSDR (OSD-575, OSD-569, OSD-656) and ~94 public NLSP sets (old ISS/Shuttle/Mir flight data, bed rest, NEEMO). Measured radiation dose: ISS TEPC + BioSentinel (CDAWeb HAPI), ExoMars TGO Liulin-MO (ESA PSA TAP), Curiosity RAD. ESA has no open human measurements (HREDA gives data dictionaries only).

## Rules for working here
- **Every threshold or number shown in the UI must carry a source link** (HRP risk page, NASA-STD-3001, OCHMO brief, or paper). Items marked *(verify)* in docs are not yet confirmed; verify before using in UI or pitch.
- Present the app as **decision support**, never medical advice.
- Real astronaut medical data is private. Use: synthetic crew data seeded from published effect sizes, real public feeds (NASA DONKI via api.nasa.gov, NOAA SWPC), PhysioNet waveforms, and live in-browser measurements. Be explicit about which is which.
- Hackathon scope: the MVP list in `docs/04-directions.md` is the contract. Push back on scope creep.
- Must work offline in principle (Mars has no live link) — any LLM/network feature needs a fallback.

## Key sources (quick links)
- HRP: https://www.nasa.gov/hrp/ · risks: https://www.nasa.gov/hrp/risks/ · roadmap: https://humanresearchroadmap.nasa.gov/risks/
- NASA-STD-3001 Vol 1 Rev C: https://standards.nasa.gov/sites/default/files/standards/NASA/C//nasa-std-3001-vol-1-rev-c-signature.pdf
- OCHMO briefs: https://www.nasa.gov/ochmo/human-spaceflight-and-aviation-standards
- OSDR: https://osdr.nasa.gov/bio/repo · API: https://www.nasa.gov/osdr-api
- DONKI / NASA APIs: https://api.nasa.gov
- ESA HREDA: https://hreda.esac.esa.int · EveryWear (prior art): https://cnes.fr/projets/cadmos/everywear
- Challenge page renders client-side; WebFetch fails on it (SSL) — use the browser tool.
