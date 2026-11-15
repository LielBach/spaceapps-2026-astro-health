// Records demo replays as .webm videos with the installed Google Chrome (playwright-core).
// Needs the server (pnpm dev:server) and the web app (pnpm dev:web) running, and once:
//   npx playwright-core install ffmpeg
// Usage: pnpm record:demos [demo ids] [--blackout] [--override q-dyspnea=yes]
// At 1920×1080 the astronaut tablet, the crew medical officer card and the charts stay on screen for
// the whole run. Demo 1 shows its imported record before the replay.
import { mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright-core";

// API_PORT and WEB_PORT match the server-alt and web-alt launch configs of a second checkout.
const API = `http://127.0.0.1:${process.env.API_PORT ?? "3001"}/api`;
const WEB = `http://localhost:${process.env.WEB_PORT ?? "5173"}`;
const OUT = join(process.cwd(), "recordings");
const SIZE = { width: 1920, height: 1080 };
/** Mission days per minute before an event opens (Q20: 1–30). The server slows to 2 at the event. */
const SPEED = 20;
const MAX_MINUTES = 25;

interface State {
  day: number;
  scenario: { mission: { lengthDays: number } };
  events: { outcome?: string; log: unknown[] }[];
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function control(body: Record<string, unknown>): Promise<void> {
  const response = await fetch(`${API}/control`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`control ${response.status}: ${await response.text()}`);
}

async function state(): Promise<State> {
  return (await (await fetch(`${API}/state`)).json()) as State;
}

/** Scrolls the page down and back up slowly, so the video shows every panel. */
async function tour(page: Page): Promise<void> {
  // Browser code as strings: the scripts tsconfig has no DOM types.
  const height = (await page.evaluate("document.body.scrollHeight")) as number;
  for (let y = 0; y <= height - SIZE.height + 150; y += 150) {
    await page.evaluate(`window.scrollTo({ top: ${y}, behavior: "smooth" })`);
    await wait(1200);
  }
  await wait(3000);
  await page.evaluate(`window.scrollTo({ top: 0, behavior: "smooth" })`);
  await wait(2500);
}

async function record(
  demo: string,
  blackout: boolean,
  overrides: Record<string, string>,
): Promise<string> {
  await control({ scenario: demo });
  await control({ playing: false, speed: SPEED, autopilot: true, blackout });
  // Live branch: a different scripted answer, as the presenter would type it.
  for (const [questionId, text] of Object.entries(overrides)) {
    const response = await fetch(`${API}/override`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ questionId, text }),
    });
    if (!response.ok) throw new Error(`override ${response.status}`);
  }
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({
    viewport: SIZE,
    recordVideo: { dir: join(OUT, "tmp"), size: SIZE },
    colorScheme: "dark",
  });
  const page = await context.newPage();
  await page.goto(WEB);
  await page.locator("[data-screen]").waitFor();
  await wait(4000);
  // Demo 1 starts from the imported record: show it before the replay runs.
  if (await page.getByText("Imported record").count()) await tour(page);
  await control({ playing: true });
  const started = Date.now();
  let openedAt: number | undefined;
  let closedAt: number | undefined;
  for (;;) {
    const s = await state();
    const outcome = s.events[0]?.outcome;
    if (s.events.length > 0 && openedAt === undefined) openedAt = Date.now();
    if (outcome && closedAt === undefined) {
      closedAt = Date.now();
      const secs = (ms: number) => Math.round(ms / 1000);
      console.log(
        `${demo}: event ${outcome} on day ${s.day.toFixed(1)}; ${secs((openedAt ?? closedAt) - started)} s to the event, ${secs(closedAt - (openedAt ?? closedAt))} s from event to close`,
      );
    }
    // Keep the clock running a little after the close, so the charts show it.
    if (closedAt !== undefined && Date.now() - closedAt > 8000) break;
    if (s.day >= s.scenario.mission.lengthDays) break;
    if (Date.now() - started > MAX_MINUTES * 60_000) {
      console.error(`${demo}: stopped after ${MAX_MINUTES} min without a closed event`);
      break;
    }
    await wait(2000);
  }
  await control({ playing: false, autopilot: false });
  await tour(page);
  const video = page.video();
  await context.close();
  await browser.close();
  const branch =
    Object.keys(overrides).length > 0 ? `-branch-${Object.keys(overrides).join("-")}` : "";
  const target = join(OUT, `${demo}${blackout ? "-blackout" : ""}${branch}.webm`);
  renameSync((await video?.path()) ?? "", target);
  return target;
}

const args = process.argv.slice(2);
const blackout = args.includes("--blackout");
const overrides: Record<string, string> = {};
args.forEach((a, i) => {
  const value = args[i + 1];
  if (a !== "--override" || !value?.includes("=")) return;
  const [questionId = "", ...text] = value.split("=");
  overrides[questionId] = text.join("=");
});
const demos = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--override");
mkdirSync(OUT, { recursive: true });
for (const demo of demos.length > 0 ? demos : ["demo2-deconditioning", "demo1-ijv-thrombosis"]) {
  console.log(`${demo}: recording${blackout ? " (comm blackout)" : ""}…`);
  console.log(`${demo}: saved ${await record(demo, blackout, overrides)}`);
}
