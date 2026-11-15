// Pure UI state for the crew tablet and the clinical panel (M1h). No React here, so it is unit-tested.
// The astronaut sees one task at a time, in plain words; the clinical panel keeps IDs and citations.
import {
  dataOf,
  type Catalog,
  type EventView,
  type LogLine,
  type SessionView,
} from "@orbivit/core";

/** The findings an answer, result or trigger line carries; none for other step types. */
export function findingsOf(line: LogLine | undefined): string[] {
  return (
    dataOf(line, "answer")?.findings ??
    dataOf(line, "result")?.findings ??
    dataOf(line, "trigger")?.findings ??
    []
  );
}

/** The reasoner's rationale for a question, test or action line. */
export function rationaleOf(line: LogLine | undefined): string | undefined {
  return line && "rationale" in line.data ? line.data.rationale : undefined;
}

export type CrewScreen =
  | "home"
  | "checkInReady"
  | "question"
  | "test"
  | "thinking"
  | "handedToCmo"
  | "followUp"
  | "urgent"
  | "resolved";

export type AlertLevel = "none" | "info" | "caution" | "warning" | "critical";

export interface Alert {
  level: AlertLevel;
  /** The level in words, so the alert does not depend on color only. */
  word: string;
  title: string;
  body?: string | undefined;
  /** Mission day shown in the body; the component adds its source context. */
  day?: number | undefined;
}

const CREW_INPUT = new Set(["answer", "result"]);

/** True once the astronaut answered a question or recorded a test in this event. */
export function hasCrewInput(event: EventView): boolean {
  return event.log.some((l) => CREW_INPUT.has(l.stepType));
}

/** The one screen the tablet shows. `started` is the local "Start check-in" tap. */
export function crewScreen(event: EventView | undefined, started: boolean): CrewScreen {
  if (!event) return "home";
  if (event.phase === "closed") return event.outcome === "escalated" ? "urgent" : "resolved";
  if (event.phase === "followUp") return "followUp";
  const next = event.pending;
  if (next?.kind === "action") return "handedToCmo";
  if (!started && !hasCrewInput(event)) return "checkInReady";
  if (next?.kind === "question") return "question";
  if (next?.kind === "test") return "test";
  return "thinking";
}

/** A silent watch: one deviating signal, no event, no contact with the astronaut (07 filter 4). */
export function silentWatch(view: SessionView): string | undefined {
  const open = view.events.some((e) => e.phase !== "closed");
  if (open) return undefined;
  const lastEventDay = Math.max(
    -Infinity,
    ...view.events.flatMap((e) => e.log.map((l) => l.missionDay)),
  );
  const watch = view.markers.findLast((m) => m.kind === "watch" && m.t > lastEventDay);
  return watch?.text.replace(/^silent watch:\s*/, "");
}

export function crewAlert(screen: CrewScreen, event: EventView | undefined): Alert {
  switch (screen) {
    case "home":
      return { level: "none", word: "All clear", title: "No check-in today" };
    case "checkInReady":
      return {
        level: "caution",
        word: "Check-in",
        title: "Your health check-in is ready",
        body: "About 2 minutes.",
      };
    case "question":
    case "test":
    case "thinking":
      return { level: "caution", word: "Check-in", title: "Check-in in progress" };
    case "handedToCmo":
      return {
        level: "info",
        word: "Done",
        title: "Your crew medical officer will review",
      };
    case "followUp":
      return {
        level: "info",
        word: "Follow-up",
        title: "Nothing to do now",
        body: "ORBIVIT checks your data until",
        day: event?.followUpUntil,
      };
    case "urgent":
      return { level: "critical", word: "Urgent", title: "Contact your crew medical officer now" };
    case "resolved":
      return { level: "none", word: "All clear", title: "Your data is back to your normal" };
  }
}

/** The alert strip of the clinical panel, worded for the crew medical officer. */
export function cmoAlert(view: SessionView, event: EventView | undefined): Alert {
  const watch = silentWatch(view);
  if (!event || (event.phase === "closed" && event.outcome === "resolved")) {
    if (watch)
      return {
        level: "info",
        word: "Info",
        title: `Silent watch: ${plainFinding(watch)}`,
        body: "One signal only. The astronaut is not contacted.",
      };
    if (event) return { level: "none", word: "Resolved", title: `Event ${event.id} resolved` };
    return { level: "none", word: "All clear", title: "No open event" };
  }
  if (event.phase === "closed") {
    const data = dataOf(
      event.log.findLast((l) => l.stepType === "escalate"),
      "escalate",
    );
    return {
      level: "critical",
      word: "Critical",
      title: `Escalated: ${data?.reason ?? "crew medical officer review"}`,
      body: data?.text,
    };
  }
  if (event.phase === "followUp")
    return {
      level: "info",
      word: "Follow-up",
      title: "Data must return to baseline, or the event escalates",
      body: "Follow-up until",
      day: event.followUpUntil,
    };
  if (event.pending?.kind === "action")
    return {
      level: "warning",
      word: "Needs your approval",
      title: "The recommended action waits for the crew medical officer",
    };
  return {
    level: "caution",
    word: "Check-in",
    title: `Event ${event.id} open`,
    body: hasCrewInput(event) ? "The astronaut is answering." : "Waiting for the astronaut.",
  };
}

export const PHASES = ["Questions", "Measure", "Review"] as const;

/** Stepper position and the question count. The reasoner picks steps, so the total is unknown. */
export function wizardProgress(event: EventView): { phase: number; question: number } {
  const question = event.log.filter((l) => l.stepType === "question").length;
  const next = event.pending;
  if (next?.kind === "action" || event.phase !== "investigating") return { phase: 2, question };
  if (next?.kind === "test") return { phase: 1, question };
  if (next?.kind === "question") return { phase: 0, question };
  const last = event.log.findLast((l) => l.stepType === "answer" || l.stepType === "result");
  return { phase: last?.stepType === "result" ? 1 : 0, question };
}

const FINDINGS: Record<string, string> = {
  "f-body-mass-down": "lower body mass",
  "f-bp-low": "low blood pressure",
  "f-bp-normal": "normal blood pressure",
  "f-bun-high": "high urea in the blood",
  "f-chest-pain": "chest pain",
  "f-clotting-history": "a history of blood clots",
  "f-co2-high": "high cabin CO2",
  "f-cognition-slow": "slower reaction time",
  "f-dizziness": "dizziness",
  "f-dyspnea": "shortness of breath",
  "f-ecg-arrhythmia": "an irregular heart rhythm",
  "f-ecg-normal": "a normal ECG",
  "f-equipment-change": "changed exercise device settings",
  "f-exercise-hr-up": "higher heart rate during exercise",
  "f-exercise-hr-up-confirmed": "higher heart rate in the exercise test",
  "f-fatigue": "more fatigue",
  "f-fever": "fever",
  "f-flank-pain": "flank pain",
  "f-headache-vision": "severe headache or vision change",
  "f-hematocrit-high": "high hematocrit",
  "f-hematocrit-low": "low hematocrit",
  "f-hematocrit-normal": "normal hematocrit",
  "f-hrv-down": "lower heart-rate variability",
  "f-hydronephrosis": "a swollen kidney on the scan",
  "f-ijv-flow-abnormal": "abnormal flow in the neck vein",
  "f-ijv-no-thrombus": "no clot in the neck vein",
  "f-ijv-noncompressible": "a neck vein that does not compress",
  "f-ijv-thrombus": "a possible clot in the neck vein",
  "f-low-fluid-intake": "lower fluid intake",
  "f-low-mood": "low mood",
  "f-max-workload-down": "lower maximum workload",
  "f-med-change": "a medication change",
  "f-missed-exercise": "missed exercise sessions",
  "f-nausea": "nausea",
  "f-neck-swelling": "neck swelling",
  "f-no-fever": "no fever",
  "f-palpitations": "palpitations",
  "f-poor-sleep": "poor sleep",
  "f-prior-ijv-flow-abnormal": "an earlier abnormal neck-vein flow",
  "f-radiation-dose-high": "a high radiation dose",
  "f-respiratory-symptoms": "breathing symptoms",
  "f-resting-hr-high": "higher resting heart rate",
  "f-resting-hr-in-band": "resting heart rate in your normal range",
  "f-rr-up": "faster breathing",
  "f-skin-temp-up": "higher skin temperature",
  "f-sleeping-hr-up": "higher sleeping heart rate",
  "f-sodium-high": "high sodium",
  "f-spo2-low": "low blood oxygen",
  "f-spo2-normal": "normal blood oxygen",
  "f-syncope": "fainting or near-fainting",
  "f-urine-dark": "dark urine",
  "f-vision-change": "a vision change",
};

/** Plain words for a finding ID; unknown IDs become words (`f-low-x` → "low x"). */
export function plainFinding(id: string): string {
  return FINDINGS[id] ?? id.replace(/^f-/, "").replaceAll("-", " ");
}

export function plainList(ids: string[]): string {
  const words = ids.map(plainFinding);
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}

/** Why the check-in started, for the astronaut. Demo 1 adds the surveillance due day. */
export function triggerText(event: EventView): {
  text: string;
  dueDay?: number | undefined;
  sourceId?: string | undefined;
} {
  const trigger = dataOf(event.log[0], "trigger");
  const findings = (trigger?.findings ?? []).filter((f) => f !== "f-resting-hr-in-band");
  const surveillance = trigger?.surveillance;
  if (event.trigger === "surveillance" && surveillance) {
    return {
      text: `Your record has an earlier neck-vein finding that needs a check under the mission medical protocol.${
        surveillance.early
          ? " Your sleeping heart rate has been higher than your normal for several nights, so the check comes earlier."
          : ""
      } It was due by`,
      dueDay: surveillance.dueDay,
      sourceId: surveillance.sourceId,
    };
  }
  if (event.trigger === "urgent") return { text: `A critical reading: ${plainList(findings)}.` };
  return {
    text: `Your wearable data has differed from your normal for several days: ${plainList(findings)}.`,
  };
}

const CONDITIONS: Record<string, string> = {
  "ijv-thrombosis": "a blood clot in a neck vein",
  "cv-deconditioning": "deconditioning of the heart and blood vessels",
  "reduced-fluid-volume": "low body fluid",
  arrhythmia: "an irregular heart rhythm",
  infection: "an infection",
};

/** Why the event escalated, in plain words for the astronaut. */
export function plainEscalation(event: EventView): string {
  const line = event.log.findLast((l) => l.stepType === "escalate");
  const reason = dataOf(line, "escalate")?.reason ?? "";
  if (reason.startsWith("red flag:"))
    return `You reported: ${reason.slice("red flag:".length).trim().toLowerCase()}.`;
  if (reason.startsWith("urgent interrupt:"))
    return `A critical reading: ${plainFinding(reason.slice("urgent interrupt:".length).trim())}.`;
  if (reason.startsWith("suspected:")) {
    const plain = line?.conditionId ? CONDITIONS[line.conditionId] : undefined;
    return `The checks suggest ${plain ?? reason.slice("suspected:".length).trim()}. You may have no symptoms now. This is suspected, not confirmed.`;
  }
  if (reason.startsWith("follow-up"))
    return "Your data did not return to your normal after the countermeasure.";
  return "Your answers need a review by your crew medical officer.";
}

/** Confidence in words. UI wording, not a clinical threshold (marked illustrative in the UI). */
export function confidenceWord(confidence: number): "high" | "moderate" | "low" {
  if (confidence >= 0.7) return "high";
  if (confidence >= 0.4) return "moderate";
  return "low";
}

const INSTRUCTIONS: Record<string, string> = {
  "t-repeat-rest-hr": "Sit still for 5 minutes with your wearable on, then press Measure.",
  "t-spo2": "Rest your hand with the finger sensor on, then press Measure.",
  "t-bp": "Put on the blood-pressure cuff, sit still, then press Measure.",
  "t-temp": "Place the thermometer, then press Measure.",
  "t-ecg": "Attach the ECG electrodes, lie still, then press Measure.",
  "t-std-exercise-test": "Do the standard exercise test on the cycle, then press Save.",
  "t-body-mass": "Use the body mass device, then press Measure.",
  "t-urine-color": "Compare your urine with the color chart, then press Save.",
  "t-istat-chem8": "Use one blood-analyzer cartridge (fingerstick), then press Measure.",
};

export function testInstruction(catalog: Catalog, testId: string): string {
  const name = catalog.tests.find((t) => t.id === testId)?.name ?? testId;
  return INSTRUCTIONS[testId] ?? `Run the test: ${name}. Then press Measure.`;
}

/** One past answer or result, in plain words. */
export function plainStep(catalog: Catalog, line: LogLine): { label: string; value: string } {
  const findings = findingsOf(line);
  const answer = dataOf(line, "answer");
  if (answer) {
    const q = catalog.questions.find((x) => x.id === line.stepId);
    return { label: q?.text ?? String(line.stepId), value: answer.text };
  }
  const name = catalog.tests.find((t) => t.id === line.stepId)?.name ?? String(line.stepId);
  return {
    label: name,
    value: findings.length > 0 ? plainList(findings) : "recorded, nothing unusual",
  };
}
