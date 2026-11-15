---
status: accepted
---

# FHIR-shaped, coded measurements with explicit mappings

Every medical datum in ORBIVIT (stream samples, real anchors, active test results, findings, suspected diagnoses) uses one interface. A datum is a coded **measurement** with a UCUM unit, provenance and a typed range. The internal types are a small subset of HL7 FHIR R4. The app exports a FHIR `Bundle`. Codes come from LOINC, SNOMED CT, ICD-10-CM and ISO/IEEE 11073-10101, and they are kept in registries that a script checks. When no standard code fits, a **local code** states its nearest standard code with a FHIR ConceptMap equivalence (`wider`, `narrower`, `inexact`, `unmatched`). The design is in [docs/technical/10](../technical/10-medical-data-standards.md).

We chose FHIR because its `Condition.verificationStatus` values `differential` and `provisional` express a suspected diagnosis exactly (ADR 0005), and because a `Bundle` is a single file that can wait out a comm blackout. We rejected two alternatives:
- **openEHR archetypes**: less tooling, and no gain for a single-app demo.
- **Local IDs only**: simpler, but a value is then unreadable without the source code.

We also rejected **a FHIR server or a full FHIR library**: the app must work offline and stay hackathon-sized.

**Consequences:** spaceflight-specific conditions such as cardiovascular deconditioning and SANS have no exact clinical code. They show `unmatched` or a `wider` mapping, and the HRP risk stays their primary reference. The app never sets `confirmed` or `refuted`: only the crew medical officer can.
