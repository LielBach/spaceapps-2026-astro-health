# The LLM chooses the next step, but only from approved pathways

The LLM picks the next question or test, but only from the steps of an approved pathway. It does not invent questions, tests, medications or doses. A rules engine still enforces safety limits and emergency exits. We chose this over a pure rules engine, which is easier to test, because adaptive questioning is the main thing the demo shows. The cost: the system needs an offline fallback for the LLM, because Mars has no live link.

Widened by [ADR 0010](0010-condition-catalog-with-uncatalogued-fallback.md): the LLM reasons over the whole condition catalog, and may name an uncatalogued diagnosis under strict limits.
