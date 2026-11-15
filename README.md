# ORBIVIT — NASA Space Apps 2026

**Challenge:** [Create Health Monitoring Software for Astronauts on Space Missions](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/)

> *On Mars, your flight surgeon is 20 minutes away. ORBIVIT notices when something is wrong before the astronaut does, investigates it with them, and follows it until it is resolved.*

## The idea in 30 seconds
- Astronauts must increasingly assess their own health (NASA's **Earth-Independent Medical Operations** goal).
- ORBIVIT runs a closed loop: **detect → investigate → assess → act → learn**. Passive sensor data starts an event; the system asks questions, requests tests cheapest first, shows ranked suspected diagnoses, recommends an action from an approved pathway, and closes the event only when follow-up data returns to baseline.
- Deviations are judged against the **astronaut's frozen pre-flight baseline + the expected in-flight band for this mission day**, not Earth ranges.
- It works offline: milestone 1 uses an online LLM with a fixed-order fallback; milestone 2 runs a local model on a MacBook.
- Concept: [06-orbivit-concept.md](docs/product/06-orbivit-concept.md) · decisions: [docs/adr/](docs/adr/) · terms: [GLOSSARY.md](GLOSSARY.md).

## Docs
`docs/product/` — what we build and why (brief, domain knowledge, directions). `docs/technical/` — data, architecture and technical designs.

| File | What's in it |
|---|---|
| [docs/product/01-challenge-brief.md](docs/product/01-challenge-brief.md) | The brief decoded; what judges will look for |
| [docs/product/02-resources.md](docs/product/02-resources.md) | Catalog of NASA / ESA / CSA / JAXA / other resources, data access reality |
| [docs/product/03-problem-space.md](docs/product/03-problem-space.md) | Health data categories, hazard→risk→indicator→action map, known monitoring problems P1–P11 |
| [docs/product/04-directions.md](docs/product/04-directions.md) | 5 candidate directions scored, recommendation, MVP, demo story (superseded by ADR 0001) |
| [docs/product/06-orbivit-concept.md](docs/product/06-orbivit-concept.md) | ORBIVIT proposal: autonomous CDSS closed loop (detect → investigate → assess → act → learn), architecture, MVP scenarios — chosen direction (ADR 0001) |
| [docs/product/07-demo-case-brief.md](docs/product/07-demo-case-brief.md) | Context and constraints for defining the demo case; standalone, ready to paste into another assistant |
| [docs/product/08-clinical-demos.md](docs/product/08-clinical-demos.md) | Demo workflows: main demo cardiovascular deconditioning (ADR 0012); secondary demo venous thrombosis |
| [GLOSSARY.md](GLOSSARY.md) · [docs/adr/](docs/adr/) | Domain terms and design decisions from the design interview |
| [docs/technical/05-data-sources.md](docs/technical/05-data-sources.md) | Data inventory by access tier (open now / free sign-up / on request / private), file formats, coverage gaps |
| [docs/technical/09-implementation-plan.md](docs/technical/09-implementation-plan.md) | MVP build plan: architecture, repo layout, engines, milestones M0–M2, tests, open items |

## Development
Needs Node 22+ and pnpm 9.

```bash
pnpm install
pnpm check        # lint, format, typecheck, tests, sources registry
pnpm dev:server   # http://127.0.0.1:3001/health
pnpm dev:web      # http://localhost:5173
```

For Claude as the clinical reasoner, copy `.env.example` to `.env` and set `ANTHROPIC_API_KEY`. Without a key, the server uses the no-LLM fallback (fixed order, unranked list).

Open http://localhost:5173, pick a demo, and press Play. **Autopilot** gives the scripted answers, test results and approval by itself (for recordings). **Comm blackout** forces the no-LLM fallback. Type a different answer in the check-in to run a live branch. Each run writes its event log to `runs/<run-id>.jsonl`.

To record the demos as videos, run the server and the web app, then `pnpm record:demos` (add `--blackout` for the no-LLM fallback). It drives the installed Google Chrome on autopilot and saves `.webm` files to `recordings/` (git-ignored). The first time, run `npx playwright-core install ffmpeg`.

Layout and plan: [docs/technical/09-implementation-plan.md](docs/technical/09-implementation-plan.md). Every number shown in the UI needs an entry in `sources.json`; `pnpm check:sources` fails on unknown IDs.

## Status
- [x] Research & direction proposal
- [x] Repo set up
- [x] Data source inventory — direction choice postponed until data review is done
- [x] Team picks direction & name: ORBIVIT closed loop (ADR 0001)
- [ ] Demo case (docs/product/07, 08)
- [x] Re-check challenge Resources tab: 5 links, no datasets; real datasets they lead to added to docs/technical/05-data-sources.md
- [x] Tech stack decision (ADR 0006)
- [x] Scaffold (M0): pnpm workspace, CI, sources registry
- [x] Simulated stream with real anchors (ADR 0003)
- [x] Detection and investigation engines with guardrails and the no-LLM fallback (M1b)
- [x] Replay server, event log and web UI: Demo 2 runs end to end (M1c)
- [x] Online clinical reasoner via the AI SDK, with guardrail retry and fallback (M1d)
- [x] Demo 1, IJV thrombosis: surveillance trigger, imported record, ultrasound structured finding, CC-BY scans (M1e)
