// The M2 evaluation cases (doc 12, ADR 0004). The main demo (ADR 0012) gates the offline model;
// the secondary demo is run and reported only. Each expectation cites the 08 workflow step or the
// catalog entry it comes from; none is a clinical threshold.
import {
  actionTaken,
  asked,
  escalated,
  escalatedWithoutAction,
  onlyEvent,
  provisional,
  resolved,
  testsBeforeAction,
  type Check,
  type RunRecord,
} from "./score.ts";

export interface EvalCase {
  id: string;
  scenario: string;
  /** The live branch: scripted answers the presenter changes. */
  overrides: Record<string, string>;
  /** True: the case decides pass/fail (main demo). False: report only. */
  gating: boolean;
  /** Default number of runs per model. */
  runs: number;
  /** Required share of passing runs (ADR 0004 criterion 2). */
  passShare: number;
  untilDay: number;
  /** Checks on the record of the first event: the one the demo shows. */
  expect: (run: RunRecord) => Check[];
}

/** The demo is judged on its first event; a later event does not repair an escalated first one. */
const first =
  (checks: (run: RunRecord) => Check[]) =>
  (run: RunRecord): Check[] =>
    checks(onlyEvent(run));

export const CASES: EvalCase[] = [
  {
    // Main demo, scripted answers (08 main demo steps 4–8).
    id: "main-base",
    scenario: "demo2-deconditioning",
    overrides: {},
    gating: true,
    runs: 10,
    passShare: 0.8,
    untilDay: 150,
    expect: first((run) => [
      // Step 6: the ranked assessment leads with deconditioning.
      provisional(run, "cv-deconditioning"),
      // Step 5: the confirming standardized test, and the ECG that rules out arrhythmia
      // (catalog: f-ecg-arrhythmia argues against deconditioning), come before the action.
      testsBeforeAction(run, ["t-std-exercise-test", "t-ecg"]),
      // Step 7: the approved countermeasure review.
      actionTaken(run, "cv-deconditioning", "a-countermeasure-review"),
      // Step 8: the follow-up trend returns to the baseline.
      resolved(run, "cv-deconditioning"),
    ]),
  },
  {
    // Live branch: the astronaut reports fever (08 step 4, question 4: infection symptoms).
    // Catalog: f-fever argues against deconditioning and supports infection, whose test is t-temp.
    id: "main-fever",
    scenario: "demo2-deconditioning",
    overrides: { "q-fever": "yes" },
    gating: true,
    runs: 5,
    passShare: 0.8,
    untilDay: 150,
    expect: first((run) => [asked(run, "q-fever"), testsBeforeAction(run, ["t-temp"])]),
  },
  {
    // Live branch: a red flag. The engine escalates at once (ADR 0010); a sanity check, not a model test.
    id: "main-chest-pain",
    scenario: "demo2-deconditioning",
    overrides: { "q-chest-pain": "yes, pressure when exercising" },
    gating: true,
    runs: 1,
    passShare: 1,
    untilDay: 125,
    expect: first((run) => [escalatedWithoutAction(run)]),
  },
  {
    // Secondary demo (08 secondary demo steps 6–8): report only.
    id: "secondary-base",
    scenario: "demo1-ijv-thrombosis",
    overrides: {},
    gating: false,
    runs: 2,
    passShare: 0.8,
    untilDay: 75,
    expect: first((run) => [
      provisional(run, "ijv-thrombosis"),
      testsBeforeAction(run, ["t-ultrasound-ijv"]),
      escalated(run),
    ]),
  },
];
