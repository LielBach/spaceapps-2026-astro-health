# One main demo: cardiovascular deconditioning; thrombosis is secondary

Supersedes the equal weight of the two demos in ADR 0008. The pitch now has **one main demo**: early detection of cardiovascular deconditioning that could compromise an astronaut's ability to function safely after landing on Mars ([08-clinical-demos.md](../product/08-clinical-demos.md), "Main demo"). We chose it because it is common, measurable and actionable, and it shows the whole loop from passive signals to recovery. A rare emergency shows less of the loop.

Consequences:
- The main demo keeps its real NASA data unchanged (ADR 0003): Alex is subject 1 of NLSP 178066 (STS-40/58), the exercise baseline uses the real STS-40 heart-rate–workload slope, and the landing step uses the DSO 402 REFERENCE band.
- The internal jugular vein thrombosis replay stays in the app as the **secondary demo** of a high-consequence risk. It is shown only if time allows. ADR 0009 still applies to it.
- The pitch shows that the same platform can handle potentially life-threatening events such as arrhythmias with one slide, not a third demo. It uses the catalog entry that already exists.
- Scenario ids stay `demo2-deconditioning` (main) and `demo1-ijv-thrombosis` (secondary), so tests and recorded runs do not change.
