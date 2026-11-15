import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { dataOf } from "@orbivit/core";
import { scenarioPaths } from "./app.ts";
import { ReplaySession } from "./session.ts";

/** Plays a scenario day by day with the scripted answers, as the autopilot does. */
async function play(session: ReplaySession, untilDay: number): Promise<void> {
  for (let guard = 0; guard < 2000 && session.day < untilDay; guard++) {
    if (session.waiting) await session.autoStep();
    else await session.advance(Math.min(1, untilDay - session.day));
  }
}

describe("Demo 2 replay with the no-LLM fallback", async () => {
  const runs = mkdtempSync(join(tmpdir(), "orbivit-runs-"));
  const session = new ReplaySession(scenarioPaths("demo2-deconditioning", runs));
  await play(session, 150);
  const view = session.view();
  const event = view.events[0]!;

  it("opens one passive event and recommends the countermeasure review", () => {
    expect(view.events).toHaveLength(1);
    expect(event.trigger).toBe("passive");
    expect(event.openedAt).toBeGreaterThan(100);
    const action = event.log.find((l) => l.stepType === "action");
    expect(action?.stepId).toBe("a-countermeasure-review");
  });

  it("closes the event as resolved after the action reverses the drift", () => {
    expect(event.outcome).toBe("resolved");
    expect(event.log.at(-1)?.stepType).toBe("close");
  });

  it("marks the two benign spikes as ignored", () => {
    expect(view.markers.filter((m) => m.kind === "ignored").length).toBeGreaterThanOrEqual(2);
  });

  it("writes every log line to the JSONL run file", () => {
    const [file] = readdirSync(runs);
    const lines = readFileSync(join(runs, file!), "utf8").trim().split("\n");
    expect(lines).toHaveLength(event.log.length);
    expect(JSON.parse(lines[0]!).stepType).toBe("trigger");
  });

  it("uses the scripted answer override for the live branch", async () => {
    const live = new ReplaySession(scenarioPaths("demo2-deconditioning", runs));
    live.override("q-chest-pain", "yes, pressure when exercising");
    await play(live, 125);
    const e = live.view().events[0]!;
    expect(e.outcome).toBe("escalated");
    expect(dataOf(e.log.at(-1), "escalate")?.reason).toMatch(/red flag/);
  });
});
