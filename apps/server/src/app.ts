import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import { ReplaySession, type ReasonerSetup, type SessionPaths } from "./session.ts";

const repo = (path: string) => fileURLToPath(new URL(`../../../${path}`, import.meta.url));

export interface AppOptions {
  /** Run the real-time replay clock. Off in tests, which drive the session directly. */
  clock?: boolean;
  /** The clinical reasoner (M1d). Without one, every step uses the no-LLM fallback. */
  llm?: ReasonerSetup | undefined;
  runsDir?: string;
}

const TICK_MS = 250;
const AUTOPILOT_DELAY_MS = 1500;

export function scenarioPaths(scenarioId: string, runsDir = repo("runs")): SessionPaths {
  return {
    scenario: repo(`scenarios/${scenarioId}.yaml`),
    anchors: repo("data/anchors"),
    catalog: repo("catalog"),
    sources: repo("sources.json"),
    runs: runsDir,
  };
}

export function listScenarios(): string[] {
  return readdirSync(repo("scenarios"))
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => f.replace(/\.yaml$/, ""))
    .sort();
}

export function buildApp(
  options: AppOptions = {},
): FastifyInstance & { session: () => ReplaySession } {
  const app = Fastify({ logger: false });
  const scenarios = listScenarios();
  let session = new ReplaySession(
    scenarioPaths(scenarios.at(-1) ?? "demo2-deconditioning", options.runsDir),
    options.llm,
  );
  const clients = new Set<(data: string) => void>();
  let unsubscribe = session.onChange(() => broadcast());
  let lastBroadcast = 0;
  let pendingBroadcast: NodeJS.Timeout | undefined;

  function broadcast(): void {
    // At most 4 full views per second.
    const wait = lastBroadcast + TICK_MS - Date.now();
    if (wait > 0) {
      pendingBroadcast ??= setTimeout(() => {
        pendingBroadcast = undefined;
        broadcast();
      }, wait);
      return;
    }
    lastBroadcast = Date.now();
    const data = JSON.stringify(session.view());
    for (const send of clients) send(data);
  }

  function load(scenarioId: string): void {
    unsubscribe();
    session = new ReplaySession(scenarioPaths(scenarioId, options.runsDir), options.llm);
    unsubscribe = session.onChange(() => broadcast());
    broadcast();
  }

  let autopilotAt = 0;
  let ticking = false;
  const timer = options.clock
    ? setInterval(() => {
        if (ticking) return;
        ticking = true;
        const tick = async () => {
          if (session.waiting && session.autopilot) {
            autopilotAt ||= Date.now() + AUTOPILOT_DELAY_MS;
            if (Date.now() >= autopilotAt) {
              autopilotAt = 0;
              await session.autoStep();
            }
          } else if (session.playing && !session.waiting) {
            autopilotAt = 0;
            await session.advance((session.speed * TICK_MS) / 60_000);
          }
        };
        tick()
          .catch((error: unknown) => app.log.error(error))
          .finally(() => (ticking = false));
      }, TICK_MS)
    : undefined;
  app.addHook("onClose", async () => {
    if (timer) clearInterval(timer);
    if (pendingBroadcast) clearTimeout(pendingBroadcast);
  });

  app.get("/health", async () => ({ status: "ok" }));
  app.get("/api/scenarios", async () => ({ scenarios, current: session.scenario.id }));
  app.get("/api/state", async () => session.view());

  app.get("/api/stream", (request, reply) => {
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    const send = (data: string) => reply.raw.write(`data: ${data}\n\n`);
    send(JSON.stringify(session.view()));
    clients.add(send);
    request.raw.on("close", () => clients.delete(send));
  });

  app.post<{
    Body: {
      scenario?: string;
      playing?: boolean;
      speed?: number;
      blackout?: boolean;
      autopilot?: boolean;
      reset?: boolean;
    };
  }>("/api/control", async (request, reply) => {
    const body = request.body ?? {};
    if (body.scenario || body.reset) {
      const id = body.scenario ?? session.scenario.id;
      if (!scenarios.includes(id)) return reply.code(404).send({ error: `unknown scenario ${id}` });
      load(id);
    }
    session.set(body);
    return { ok: true };
  });

  app.post<{ Body: { eventId: string; questionId: string; text?: string } }>(
    "/api/answer",
    async (request) => {
      const { eventId, questionId, text } = request.body;
      await session.answer(eventId, questionId, text);
      return { ok: true };
    },
  );

  app.post<{ Body: { eventId: string; testId: string } }>("/api/test", async (request) => {
    await session.runTest(request.body.eventId, request.body.testId);
    return { ok: true };
  });

  app.post<{ Body: { eventId: string } }>("/api/approve", async (request) => {
    session.approve(request.body.eventId);
    return { ok: true };
  });

  app.post<{ Body: { questionId: string; text?: string } }>("/api/override", async (request) => {
    session.override(request.body.questionId, request.body.text);
    return { ok: true };
  });

  app.post<{ Body: { days: number } }>("/api/advance", async (request) => {
    await session.advance(request.body.days);
    return { day: session.day, waiting: session.waiting };
  });

  return Object.assign(app, { session: () => session });
}
