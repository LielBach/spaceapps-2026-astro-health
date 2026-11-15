import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildApp, scenarioPaths } from "./app.ts";
import { ReplaySession } from "./session.ts";

const runs = mkdtempSync(join(tmpdir(), "orbivit-story-"));

describe("Presenter mode of the main demo", () => {
  it("steps through every beat to a resolved event", async () => {
    const session = new ReplaySession(scenarioPaths("demo2-deconditioning", runs));
    const beats = session.view().story.beats;
    expect(beats.length).toBeGreaterThan(5);
    for (let i = 0; i < beats.length; i++) await session.goToBeat(i);
    const view = session.view();
    expect(view.story.current).toBe(beats.length - 1);
    expect(view.events).toHaveLength(1);
    expect(view.events[0]?.outcome).toBe("resolved");
    expect(view.playing).toBe(false);
  });

  it("opens the event at the deviation beat and waits for the action at the test beat", async () => {
    const session = new ReplaySession(scenarioPaths("demo2-deconditioning", runs));
    await session.goToBeat(2);
    expect(session.view().events).toHaveLength(0);
    await session.goToBeat(3);
    expect(session.view().events[0]?.pending).toBeDefined();
    await session.goToBeat(5);
    expect(session.view().events[0]?.pending?.kind).toBe("action");
    expect(session.view().events[0]?.diagnoses[0]?.ref).toEqual({
      conditionId: "cv-deconditioning",
    });
  });

  it("goes back by replaying from a fresh session over HTTP", async () => {
    const app = buildApp({ runsDir: runs });
    await app.inject({
      method: "POST",
      url: "/api/control",
      payload: { scenario: "demo2-deconditioning" },
    });
    let r = await app.inject({ method: "POST", url: "/api/story", payload: { beat: 6 } });
    expect(r.json()).toMatchObject({ beat: 6 });
    r = await app.inject({ method: "POST", url: "/api/story", payload: { beat: 2 } });
    expect(r.json()).toMatchObject({ beat: 2 });
    expect(app.session().view().events).toHaveLength(0);
    r = await app.inject({ method: "POST", url: "/api/story", payload: { exit: true } });
    expect(app.session().view().story.current).toBeUndefined();
    r = await app.inject({ method: "POST", url: "/api/story", payload: { beat: -1 } });
    expect(r.statusCode).toBe(400);
    await app.close();
  });
});
