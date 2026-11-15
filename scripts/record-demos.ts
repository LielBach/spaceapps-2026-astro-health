// Records demo replays as .webm videos with the installed Google Chrome (playwright-core).
// Needs the server (pnpm dev:server) and the web app (pnpm dev:web) running, and once:
//   npx playwright-core install ffmpeg
// Usage: pnpm record:demos [demo2-deconditioning] [demo1-ijv-thrombosis] [--blackout]
import { mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright-core";

const API = "http://127.0.0.1:3001/api";
const WEB = "http://localhost:5173";
const OUT = join(process.cwd(), "recordings");
const SIZE = { width: 1280, height: 800 };
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
  for (let y = 0; y <= height; y += 200) {
    await page.evaluate(`window.scrollTo({ top: ${y}, behavior: "smooth" })`);
    await wait(900);
  }
  await wait(1500);
  await page.evaluate(`window.scrollTo({ top: 0, behavior: "smooth" })`);
  await wait(2500);
}

async function record(demo: string, blackout: boolean): Promise<string> {
  await control({ scenario: demo });
  await control({ playing: false, speed: SPEED, autopilot: true, blackout });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({
    viewport: SIZE,
    recordVideo: { dir: join(OUT, "tmp"), size: SIZE },
    colorScheme: "dark",
  });
  const page = await context.newPage();
  await page.goto(WEB);
  await page.getByText("Imported record").or(page.getByText("Daily check-in")).first().waitFor();
  await wait(4000);
  await control({ playing: true });
  const started = Date.now();
  let closedAt: number | undefined;
  for (;;) {
    const s = await state();
    const outcome = s.events[0]?.outcome;
    if (outcome && closedAt === undefined) {
      closedAt = Date.now();
      console.log(`${demo}: event ${outcome} on day ${s.day.toFixed(1)}`);
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
  const target = join(OUT, `${demo}${blackout ? "-blackout" : ""}.webm`);
  renameSync((await video?.path()) ?? "", target);
  return target;
}

const args = process.argv.slice(2);
const blackout = args.includes("--blackout");
const demos = args.filter((a) => !a.startsWith("--"));
mkdirSync(OUT, { recursive: true });
for (const demo of demos.length > 0 ? demos : ["demo2-deconditioning", "demo1-ijv-thrombosis"]) {
  console.log(`${demo}: recording${blackout ? " (comm blackout)" : ""}…`);
  console.log(`${demo}: saved ${await record(demo, blackout)}`);
}
