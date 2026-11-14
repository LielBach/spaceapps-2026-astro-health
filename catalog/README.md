# Condition catalog (ADR 0010)

**Status: DRAFT, needs clinical review.** An LLM drafted these files from public NASA sources, as ADR 0010 allows. No entry is validated. Every entry cites `catalog-draft`, which is marked verify in `sources.json`, until a reviewer signs it off.

- `questions.yaml`: questions the system may ask, and the finding each answer gives.
- `equipment.yaml`: devices on board and their tests, and the finding each result gives.
- `red-flags.yaml`: findings that stop the investigation and escalate.
- `conditions/*.yaml`: one condition each. `supports` and `against` list findings; `questions`, `tests` and `actions` form its approved pathway.
