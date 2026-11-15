import { describe, expect, it } from "vitest";
import type { EventView, LogLine, SessionView } from "@astrohealth/core";
import {
  cmoAlert,
  confidenceWord,
  crewAlert,
  crewScreen,
  plainEscalation,
  plainFinding,
  silentWatch,
  triggerText,
  wizardProgress,
} from "./flow.ts";

let n = 0;
function line(
  stepType: LogLine["stepType"],
  data: Record<string, unknown> = {},
  extra: Partial<LogLine> = {},
): LogLine {
  n += 1;
  return {
    id: `evt-001-${String(n).padStart(3, "0")}`,
    timestamp: "",
    missionDay: 40 + n / 100,
    eventId: "evt-001",
    stepType,
    label: "SIMULATED",
    ruleVersion: "test",
    data,
    ...extra,
  };
}

function event(over: Partial<EventView> = {}): EventView {
  return {
    id: "evt-001",
    trigger: "passive",
    phase: "investigating",
    outcome: undefined,
    openedAt: 40,
    pending: { kind: "question", id: "q-chest-pain" },
    pendingWording: undefined,
    diagnoses: [],
    unranked: false,
    followUpUntil: undefined,
    log: [line("trigger", { trigger: "passive", findings: ["f-exercise-hr-up"] })],
    ...over,
  };
}

function view(events: EventView[], markers: SessionView["markers"] = []): SessionView {
  return {
    events,
    markers,
    scenario: { mission: { commDelayMinutes: 20 } },
  } as unknown as SessionView;
}

describe("crewScreen", () => {
  it("shows home without an event", () => expect(crewScreen(undefined, false)).toBe("home"));
  it("asks to start a new check-in before any answer", () =>
    expect(crewScreen(event(), false)).toBe("checkInReady"));
  it("shows the question after Start", () => expect(crewScreen(event(), true)).toBe("question"));
  it("skips the start screen once the crew answered (autopilot)", () => {
    const e = event({ log: [...event().log, line("answer", { text: "no", findings: [] })] });
    expect(crewScreen(e, false)).toBe("question");
  });
  it("shows a test step", () =>
    expect(crewScreen(event({ pending: { kind: "test", id: "t-bp" } }), true)).toBe("test"));
  it("waits while the reasoner works", () =>
    expect(crewScreen(event({ pending: undefined }), true)).toBe("thinking"));
  it("hands over to the crew medical officer for an action", () =>
    expect(
      crewScreen(event({ pending: { kind: "action", conditionId: "c", actionId: "a" } }), false),
    ).toBe("handedToCmo"));
  it("shows follow-up", () =>
    expect(crewScreen(event({ phase: "followUp", pending: undefined }), true)).toBe("followUp"));
  it("interrupts on escalation", () =>
    expect(crewScreen(event({ phase: "closed", outcome: "escalated" }), true)).toBe("urgent"));
  it("shows resolved", () =>
    expect(crewScreen(event({ phase: "closed", outcome: "resolved" }), true)).toBe("resolved"));
});

describe("alerts", () => {
  it("grades the crew alert by screen", () => {
    expect(crewAlert("home", undefined).level).toBe("none");
    expect(crewAlert("checkInReady", undefined).level).toBe("caution");
    expect(crewAlert("question", undefined).level).toBe("caution");
    expect(crewAlert("handedToCmo", undefined).level).toBe("info");
    expect(crewAlert("followUp", event({ followUpUntil: 50 })).day).toBe(50);
    expect(crewAlert("urgent", undefined).level).toBe("critical");
    expect(crewAlert("resolved", undefined).level).toBe("none");
  });

  it("grades the clinical alert", () => {
    expect(cmoAlert(view([]), undefined).level).toBe("none");
    expect(cmoAlert(view([]), event()).level).toBe("caution");
    const action = event({ pending: { kind: "action", conditionId: "c", actionId: "a" } });
    expect(cmoAlert(view([action]), action).level).toBe("warning");
    const esc = event({
      phase: "closed",
      outcome: "escalated",
      log: [line("escalate", { reason: "red flag: Chest pain" })],
    });
    expect(cmoAlert(view([esc]), esc)).toMatchObject({ level: "critical" });
  });

  it("shows a silent watch to the clinical panel only", () => {
    const v = view([], [{ t: 38, kind: "watch", text: "silent watch: f-sleeping-hr-up" }]);
    expect(silentWatch(v)).toBe("f-sleeping-hr-up");
    expect(cmoAlert(v, undefined).title).toBe("Silent watch: higher sleeping heart rate");
    expect(crewScreen(undefined, false)).toBe("home");
  });

  it("ignores a watch once an event is open", () => {
    const v = view([event()], [{ t: 38, kind: "watch", text: "silent watch: f-x" }]);
    expect(silentWatch(v)).toBeUndefined();
  });
});

describe("wizardProgress", () => {
  it("places questions, tests and the action in the three phases", () => {
    expect(wizardProgress(event()).phase).toBe(0);
    expect(wizardProgress(event({ pending: { kind: "test", id: "t-bp" } })).phase).toBe(1);
    expect(
      wizardProgress(event({ pending: { kind: "action", conditionId: "c", actionId: "a" } })).phase,
    ).toBe(2);
  });
  it("counts the questions asked", () => {
    const e = event({ log: [line("question"), line("answer"), line("question")] });
    expect(wizardProgress(e).question).toBe(2);
  });
});

describe("plain language", () => {
  it("maps known findings and falls back to words", () => {
    expect(plainFinding("f-low-fluid-intake")).toBe("lower fluid intake");
    expect(plainFinding("f-some-new-thing")).toBe("some new thing");
  });
  it("words the trigger without the context finding", () => {
    const e = event({
      log: [
        line("trigger", {
          findings: ["f-exercise-hr-up", "f-max-workload-down", "f-resting-hr-in-band"],
        }),
      ],
    });
    expect(triggerText(e).text).toContain(
      "higher heart rate during exercise and lower maximum workload.",
    );
  });
  it("words the surveillance trigger with its due day", () => {
    const e = event({
      trigger: "surveillance",
      log: [line("trigger", { surveillance: { dueDay: 60, early: true, sourceId: "s" } })],
    });
    expect(triggerText(e)).toMatchObject({ dueDay: 60, sourceId: "s" });
  });
  it("words escalations", () => {
    const red = event({
      log: [line("escalate", { reason: "red flag: New or sudden shortness of breath" })],
    });
    expect(plainEscalation(red)).toBe("You reported: new or sudden shortness of breath.");
    const ijv = event({
      log: [line("escalate", { reason: "suspected: IJV" }, { conditionId: "ijv-thrombosis" })],
    });
    expect(plainEscalation(ijv)).toContain("a blood clot in a neck vein");
  });
  it("words confidence", () => {
    expect(confidenceWord(0.9)).toBe("high");
    expect(confidenceWord(0.55)).toBe("moderate");
    expect(confidenceWord(0.2)).toBe("low");
  });
});
