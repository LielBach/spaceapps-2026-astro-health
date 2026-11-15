# Two demos: cardiovascular deconditioning and venous thrombosis

> **Changed by ADR 0012:** deconditioning is now the one main demo; thrombosis is a secondary demo, shown only if time allows. Both replays stay in the app.

We build both demos in [08-clinical-demos.md](../product/08-clinical-demos.md) as replays: cardiovascular deconditioning (main, shown first) and internal jugular vein thrombosis (second). We considered one full replay plus a short scene, which halves the scope. We chose two, because they show two different strengths: routine trend detection, and risk-aware reasoning when there are no symptoms. The cost: Demo 1 also needs an imported medical record and an ultrasound step.
