# BASELINE (working name) — NASA Space Apps 2026

**Challenge:** [Create Health Monitoring Software for Astronauts on Space Missions](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/)

> *On Mars, your flight surgeon is 20 minutes away. BASELINE gives every astronaut the judgment to know what's normal **for them, today, in this gravity** — and what to do next.*

## The idea in 30 seconds
- Astronauts must increasingly assess their own health (NASA's **Earth-Independent Medical Operations** goal).
- Earth "normal ranges" mislead in space: bodies adapt (fluid shift, bone loss 1–1.5 %/month, ~70 % show eye swelling).
- BASELINE judges each indicator against the **astronaut's own baseline + expected adaptation for this mission day and gravity**, fuses it with **cabin hazards** (CO2, radiation, real NASA space-weather alerts), and runs **latency-aware triage**: self-care → crew medical officer → ground.
- UI: clickable body map, color status, trends, guided "how / why / when to worry / what to do" cards, 3-minute daily check-in with a reaction-time test.

## Docs
`docs/product/` — what we build and why (brief, domain knowledge, directions). `docs/technical/` — data, architecture and technical designs.

| File | What's in it |
|---|---|
| [docs/product/01-challenge-brief.md](docs/product/01-challenge-brief.md) | The brief decoded; what judges will look for |
| [docs/product/02-resources.md](docs/product/02-resources.md) | Catalog of NASA / ESA / CSA / JAXA / other resources, data access reality |
| [docs/product/03-problem-space.md](docs/product/03-problem-space.md) | Health data categories, hazard→risk→indicator→action map, known monitoring problems P1–P11 |
| [docs/product/04-directions.md](docs/product/04-directions.md) | 5 candidate directions scored, recommendation, MVP, demo story |
| [docs/product/06-astrohealth-concept.md](docs/product/06-astrohealth-concept.md) | AstroHealth proposal: autonomous CDSS closed loop (detect → investigate → assess → act → learn), architecture, MVP scenarios — not yet confirmed |
| [docs/technical/05-data-sources.md](docs/technical/05-data-sources.md) | Data inventory by access tier (open now / free sign-up / on request / private), file formats, coverage gaps |

## Status
- [x] Research & direction proposal
- [x] Repo set up
- [x] Data source inventory — direction choice postponed until data review is done
- [ ] Team picks direction & name (options discussed: A+C live camera moment, B+A mind & sleep core, F deep-dive on SANS)
- [x] Re-check challenge Resources tab: 5 links, no datasets; real datasets they lead to added to docs/technical/05-data-sources.md
- [ ] Tech stack decision & scaffold
- [ ] Synthetic crew generator
- [ ] MVP features (see docs/product/04-directions.md)
