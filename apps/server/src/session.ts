// One replay run (plan §5.2, §5.6): clock, stream, detection, investigation and the JSONL event log.
// The clock is driven from outside (advance), so tests run without timers.
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_DETECTION,
  dataOf,
  type SurveillanceTriggerData,
  Detector,
  Investigation,
  ruleBasedProposal,
  type Anchor,
  type Catalog,
  type DetectionOutput,
  type MetricId,
  type LlmInfo,
  type Proposal,
  type ChartPoint,
  type Marker,
  type SessionView,
} from "@orbivit/core";
import {
  createStream,
  loadAnchors,
  loadCatalog,
  loadScenario,
  normalizeAnchors,
  scenarioProblems,
  type Intervention,
  type Scenario,
  type ScenarioMedia,
  type StoryMoveSpec,
  type Stream,
} from "@orbivit/data";

export const RULE_VERSION = "m1g-0.1";

const round1 = (x: number) => Math.round(x * 10) / 10;

/** Proposes the next step. Returns undefined to use the no-LLM fallback. */
export type Reasoner = (
  inv: Investigation,
  ctx: { retryReasons?: string[] },
) => Promise<{ proposal: Proposal; llm: LlmInfo } | undefined>;

export interface ReasonerSetup {
  reasoner: Reasoner;
  info: LlmInfo;
}

/** A reassessment that a record finding schedules (plan §5.3 step 6). */
interface Surveillance {
  conditionId: string;
  recordEntry: string;
  recordDay: number;
  finding: string;
  dueDay: number;
  earlyOnWatch: boolean;
  sourceId: string;
  openedAt: number | undefined;
}

export interface SessionPaths {
  scenario: string;
  anchors: string;
  catalog: string;
  sources: string;
  runs: string;
}

export class ReplaySession {
  readonly runId: string;
  readonly scenario: Scenario;
  readonly catalog: Catalog;
  day: number;
  playing = false;
  /** Mission days per real minute (Q20: 1–30). */
  speed = 10;
  blackout = false;
  autopilot = false;
  readonly overrides: Record<string, string> = {};
  /** Presenter mode: index of the story beat on screen, or undefined when it is off. */
  storyBeat: number | undefined;
  private readonly stream: Stream;
  private readonly detector: Detector;
  private readonly runFile: string;
  private readonly sources: SessionView["sources"];
  private readonly points: ChartPoint[] = [];
  private readonly hr: SessionView["hr"] = [];
  private readonly markers: Marker[] = [];
  private readonly events: Investigation[] = [];
  private readonly interventions: Intervention[] = [];
  private readonly cleared = new Set<string>();
  private readonly anchors: Anchor[];
  private readonly surveillance: Surveillance[];
  private written = new Map<string, number>();
  private busy = false;
  private readonly listeners = new Set<() => void>();

  constructor(
    paths: SessionPaths,
    private readonly llm: ReasonerSetup | undefined = undefined,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.scenario = loadScenario(paths.scenario);
    this.catalog = loadCatalog(paths.catalog);
    this.sources = (
      JSON.parse(readFileSync(paths.sources, "utf8")) as { sources: SessionView["sources"] }
    ).sources;
    this.anchors = normalizeAnchors(
      loadAnchors(paths.anchors, this.scenario.astronaut.anchorSources),
      this.catalog,
    );
    const problems = scenarioProblems(this.scenario, this.catalog);
    if (problems.length > 0)
      throw new Error(`scenario ${this.scenario.id}:\n${problems.join("\n")}`);
    this.stream = createStream(this.scenario, this.anchors);
    this.surveillance = this.scenario.record.flatMap((entry) =>
      this.catalog.conditions
        .filter((c) => c.surveillance && c.surveillance.recordFinding === entry.finding)
        .map((c) => ({
          conditionId: c.id,
          recordEntry: entry.id,
          recordDay: entry.day,
          finding: entry.finding ?? "",
          dueDay: entry.day + (c.surveillance?.repeatWithinDays ?? 0),
          earlyOnWatch: c.surveillance?.earlyOnWatch ?? false,
          sourceId: c.surveillance?.sourceId ?? "illustrative",
          openedAt: undefined,
        })),
    );
    const start = this.scenario.mission.replayFromDay;
    // The frozen baseline uses the 30 days before the replay starts (Q19).
    this.detector = new Detector({ ...DEFAULT_DETECTION, baselineDays: [start - 30, start] });
    const window = this.stream.samplesBetween(start - 30, start);
    for (const s of window)
      if (s.signal === "hr") this.hr.push({ t: s.t, value: s.value, context: s.context ?? "" });
    for (const out of this.detector.ingest(window)) {
      if (out.kind === "baselineWindow") {
        this.points.push({
          t: out.t,
          metric: out.metric,
          value: out.value,
          baseline: null,
          limit: null,
          deviating: false,
        });
      }
    }
    this.day = start;
    this.runId = `${this.scenario.id}-${this.now().toISOString().replace(/[:.]/g, "-")}`;
    mkdirSync(paths.runs, { recursive: true });
    this.runFile = join(paths.runs, `${this.runId}.jsonl`);
  }

  get provider(): LlmInfo["provider"] {
    return this.blackout || !this.llm ? "none" : this.llm.info.provider;
  }

  /** The replay waits for the astronaut or the crew medical officer. */
  get waiting(): boolean {
    return (
      this.busy || this.events.some((e) => e.phase === "investigating" && e.pending !== undefined)
    );
  }

  get active(): Investigation | undefined {
    return this.events.find((e) => e.phase !== "closed");
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Advances mission time by `days`, unless the replay waits for an answer. */
  async advance(days: number): Promise<void> {
    if (this.waiting || days <= 0) return;
    const end = Math.min(this.day + days, this.scenario.mission.lengthDays);
    let from = this.day;
    // Step in hours so an event can stop the clock at the hour it opens.
    while (from < end - 1e-9 && !this.waiting) {
      const to = Math.min(end, Math.floor(from * 24 + 1e-6) / 24 + 1 / 24);
      const samples = this.stream.samplesBetween(from, to, this.interventions);
      for (const s of samples)
        if (s.signal === "hr") this.hr.push({ t: s.t, value: s.value, context: s.context ?? "" });
      for (const out of this.detector.ingest(samples)) await this.handle(out);
      const newDay = Math.floor(to + 1e-9) > Math.floor(from + 1e-9);
      from = to;
      this.day = to;
      if (newDay) {
        this.followUp();
        await this.surveil(to);
      }
    }
    if (this.day >= this.scenario.mission.lengthDays) this.playing = false;
    this.emit();
  }

  async answer(eventId: string, questionId: string, text?: string): Promise<void> {
    const inv = this.event(eventId);
    if (inv.pending?.kind !== "question" || inv.pending.id !== questionId)
      throw new Error(`no pending question ${questionId}`);
    inv.setTime(this.day);
    inv.answer(questionId, text ?? this.scriptedAnswer(questionId));
    await this.next(inv);
  }

  /** Records a test result: the scripted one, or values the operator entered (structured finding). */
  async runTest(
    eventId: string,
    testId: string,
    values?: Record<string, number | string | boolean>,
  ): Promise<void> {
    const inv = this.event(eventId);
    if (inv.pending?.kind !== "test" || inv.pending.id !== testId)
      throw new Error(`no pending test ${testId}`);
    inv.setTime(this.day);
    inv.result(testId, values ?? this.scenario.testResults[testId] ?? {});
    await this.next(inv);
  }

  /** The crew medical officer approves the recommended action. */
  approve(eventId: string): void {
    const inv = this.event(eventId);
    inv.setTime(this.day);
    const taken = inv.act();
    if (!taken) throw new Error("no pending action");
    this.interventions.push({ action: taken.actionId, day: this.day });
    this.cleared.clear();
    this.markers.push({ t: this.day, kind: "action", text: taken.actionId });
    if (inv.phase === "closed")
      this.detector.setEventOpen(this.events.some((e) => e.phase !== "closed"));
    // Follow-up runs over weeks: return to the normal replay speed.
    this.speed = Math.max(this.speed, 10);
    this.flush();
    this.emit();
  }

  /** Performs the pending step with the scripted answer, result or approval (autopilot and tests). */
  async autoStep(): Promise<boolean> {
    const inv = this.events.find((e) => e.phase === "investigating" && e.pending);
    const next = inv?.pending;
    if (!inv || !next) return false;
    if (next.kind === "question") await this.answer(inv.eventId, next.id);
    else if (next.kind === "test") await this.runTest(inv.eventId, next.id);
    else if (next.kind === "action") this.approve(inv.eventId);
    return true;
  }

  scriptedAnswer(questionId: string): string {
    return (
      this.overrides[questionId] ??
      this.scenario.answers.byQuestion[questionId] ??
      this.scenario.answers.default
    );
  }

  /**
   * Presenter mode: runs the moves of each beat after the current one, up to `beat`.
   * Going back needs a fresh session (the caller reloads the scenario and calls this again).
   */
  async goToBeat(beat: number): Promise<void> {
    const beats = this.scenario.story;
    if (beats.length === 0) throw new Error(`scenario ${this.scenario.id} has no story`);
    const target = Math.max(0, Math.min(beat, beats.length - 1));
    if (this.storyBeat !== undefined && target < this.storyBeat)
      throw new Error("going back needs a fresh session");
    this.playing = false;
    this.autopilot = false;
    for (let i = (this.storyBeat ?? -1) + 1; i <= target; i++) {
      for (const move of beats[i]?.do ?? []) await this.move(move);
      this.storyBeat = i;
    }
    this.emit();
  }

  private async move(move: StoryMoveSpec): Promise<void> {
    const end = this.scenario.mission.lengthDays;
    if ("advanceTo" in move) {
      await this.advance(move.advanceTo - this.day);
    } else if ("advanceUntil" in move) {
      if (move.advanceUntil === "event") {
        await this.advance(end - this.day);
      } else {
        // Day by day, so the follow-up closes the event on the day it would in the replay.
        while (this.active && !this.waiting && this.day < end) await this.advance(1);
      }
    } else if ("stepUntil" in move) {
      for (let i = 0; i < 200; i++) {
        const pending = this.active?.pending;
        if (!pending || pending.kind === move.stepUntil) break;
        await this.autoStep();
      }
    } else {
      const inv = this.active;
      if (inv?.pending?.kind === "action") this.approve(inv.eventId);
    }
  }

  set(options: {
    playing?: boolean;
    speed?: number;
    blackout?: boolean;
    autopilot?: boolean;
  }): void {
    if (options.playing !== undefined) this.playing = options.playing;
    if (options.speed !== undefined) this.speed = Math.min(30, Math.max(1, options.speed));
    if (options.blackout !== undefined) this.blackout = options.blackout;
    if (options.autopilot !== undefined) this.autopilot = options.autopilot;
    this.emit();
  }

  override(questionId: string, text: string | undefined): void {
    if (text === undefined || text === "") delete this.overrides[questionId];
    else this.overrides[questionId] = text;
    this.emit();
  }

  view(): SessionView {
    return {
      runId: this.runId,
      scenario: {
        id: this.scenario.id,
        title: this.scenario.title,
        mission: this.scenario.mission,
      },
      astronaut: this.scenario.astronaut,
      day: this.day,
      playing: this.playing,
      speed: this.speed,
      blackout: this.blackout,
      autopilot: this.autopilot,
      waiting: this.waiting,
      reasoning: this.busy,
      model: this.blackout ? undefined : this.llm?.info.model,
      provider: this.provider,
      points: this.points,
      hr: this.hr,
      markers: this.markers,
      events: this.events.map((e) => ({
        id: e.eventId,
        trigger: dataOf(e.log[0], "trigger")?.trigger ?? "passive",
        phase: e.phase,
        outcome: e.outcome,
        openedAt: e.log[0]?.missionDay ?? 0,
        pending: e.pending,
        pendingWording: e.pendingWording,
        diagnoses: e.diagnoses,
        unranked: e.unranked,
        followUpUntil: e.followUpUntil,
        log: e.log,
      })),
      overrides: this.overrides,
      scripted: { answers: this.scenario.answers, testResults: this.scenario.testResults },
      catalog: this.catalog,
      sources: this.sources,
      record: {
        entries: this.scenario.record.map((e) => ({
          ...e,
          image: e.image ? media(e.image) : undefined,
        })),
        labs: this.labs(),
      },
      surveillance: this.surveillance.map((s) => ({
        conditionId: s.conditionId,
        recordEntry: s.recordEntry,
        dueDay: s.dueDay,
        openedAt: s.openedAt,
        sourceId: s.sourceId,
      })),
      charts: this.scenario.charts as MetricId[] | undefined,
      hrBaselineSourceId: this.scenario.stream.baselines.hr?.sourceId,
      story: {
        beats: this.scenario.story.map((b) => ({ title: b.title, say: b.say, focus: b.focus })),
        current: this.storyBeat,
      },
      testImages: Object.fromEntries(
        Object.entries(this.scenario.testImages).map(([id, m]) => [id, media(m)]),
      ),
    };
  }

  /** Real lab values of the astronaut at the scenario's timepoint, in the scenario's order. */
  private labs(): SessionView["record"]["labs"] {
    const spec = this.scenario.labs;
    if (!spec) return [];
    return spec.measures.flatMap((measure) => {
      const a = this.anchors.find(
        (x) =>
          x.astronautId === this.scenario.astronaut.id &&
          x.measure === measure &&
          x.condition === spec.timepoint,
      );
      return a
        ? [
            {
              measure,
              value: a.value,
              unit: a.unit,
              timepoint: a.condition,
              range: a.range,
              label: a.label,
              sourceId: a.sourceId,
            },
          ]
        : [];
    });
  }

  /**
   * Surveillance trigger: opens the scheduled reassessment when it is due, or earlier when a
   * silent watch fires after the record finding (risk-adaptive, Demo 1 step 6B).
   */
  private async surveil(t: number, watchFinding?: string): Promise<void> {
    for (const s of this.surveillance) {
      if (s.openedAt !== undefined || t < s.recordDay || this.active) continue;
      const early = watchFinding !== undefined && s.earlyOnWatch && t < s.dueDay;
      if (!early && t < s.dueDay) continue;
      s.openedAt = t;
      const findings: { id: string; origin: "signal" | "record" }[] = [
        { id: s.finding, origin: "record" },
      ];
      if (early && watchFinding) findings.push({ id: watchFinding, origin: "signal" });
      const daysEarly = round1(s.dueDay - t);
      this.markers.push({
        t,
        kind: "surveillance",
        text: early
          ? `surveillance trigger: reassessment brought forward ${daysEarly} days (${watchFinding})`
          : "surveillance trigger: scheduled reassessment due",
      });
      const inv = this.open("surveillance", t, findings, {
        surveillance: {
          conditionId: s.conditionId,
          recordEntry: s.recordEntry,
          dueDay: s.dueDay,
          early,
          daysEarly: early ? daysEarly : 0,
          sourceId: s.sourceId,
        },
      });
      this.speed = Math.min(this.speed, 2);
      await this.next(inv);
      return;
    }
  }

  // ---------- Internals ----------

  private async handle(out: DetectionOutput): Promise<void> {
    switch (out.kind) {
      case "deviation":
      case "inBand":
        this.points.push({
          t: out.t,
          metric: out.metric,
          value: out.value,
          baseline: out.baseline,
          limit: out.limit,
          deviating: out.kind === "deviation",
        });
        return;
      case "ignored":
        this.markers.push({
          t: out.t,
          kind: "ignored",
          text: `HR ${out.value} bpm ignored: ${out.reason}`,
        });
        return;
      case "watch":
        this.markers.push({
          t: out.t,
          kind: "watch",
          text: `silent watch: ${out.finding}`,
          metric: out.metric,
        });
        await this.surveil(out.t, out.finding);
        return;
      case "cleared":
        this.cleared.add(out.finding);
        this.markers.push({
          t: out.t,
          kind: "cleared",
          text: `back in band: ${out.finding}`,
          metric: out.metric,
        });
        this.followUp();
        return;
      case "baselineUpdated":
        this.markers.push({
          t: out.t,
          kind: "baselineUpdated",
          text: `baseline ${out.metric} ${out.from} → ${out.to}`,
          metric: out.metric,
        });
        return;
      case "urgent": {
        this.markers.push({ t: out.t, kind: "urgent", text: `urgent: ${out.finding}` });
        const inv = this.open("urgent", out.t, [{ id: out.finding, origin: "signal" }]);
        inv.escalate(`urgent interrupt: ${out.finding}`);
        this.flush();
        return;
      }
      case "open": {
        this.markers.push({
          t: out.t,
          kind: "open",
          text: `event opened: ${out.findings.join(", ")}`,
        });
        const inv = this.open("passive", out.t, [
          ...out.findings.map((id) => ({ id, origin: "signal" as const })),
          ...out.context.map((id) => ({ id, origin: "signal" as const, context: true })),
        ]);
        // Q20: slow down when an event opens.
        this.speed = Math.min(this.speed, 2);
        await this.next(inv);
        return;
      }
      default:
        return;
    }
  }

  private open(
    trigger: "passive" | "urgent" | "surveillance",
    t: number,
    findings: { id: string; origin: "signal" | "record"; context?: boolean }[],
    triggerData?: { surveillance: SurveillanceTriggerData },
  ): Investigation {
    const inv = new Investigation(this.catalog, {
      eventId: `evt-${String(this.events.length + 1).padStart(3, "0")}`,
      astronautId: this.scenario.astronaut.id,
      trigger,
      t,
      ruleVersion: RULE_VERSION,
      findings,
      triggerData,
      now: () => this.now().toISOString(),
    });
    this.events.push(inv);
    this.detector.setEventOpen(true);
    return inv;
  }

  /** Asks the reasoner for the next step: one retry after a guardrail rejection, then the fallback. */
  private async next(inv: Investigation): Promise<void> {
    this.busy = true;
    this.emit();
    try {
      if (inv.phase === "investigating") {
        let reasons: string[] = [];
        // Plan §5.4: one retry after a guardrail rejection, then the no-LLM fallback.
        for (let attempt = 0; attempt < 2 && !this.blackout && this.llm; attempt++) {
          const { reasoner, info } = this.llm;
          const result = await reasoner(inv, attempt > 0 ? { retryReasons: reasons } : {}).catch(
            (error: unknown) => {
              const message = error instanceof Error ? error.message : String(error);
              inv.reject([`reasoner error: ${message}`], info);
              return undefined;
            },
          );
          if (!result) break;
          reasons = inv.apply(result.proposal, result.llm);
          if (reasons.length === 0) break;
        }
        if (inv.pending === undefined && inv.phase === "investigating") {
          inv.apply(ruleBasedProposal(inv), { provider: "none" });
        }
      }
      if (inv.phase === "closed")
        this.detector.setEventOpen(this.events.some((e) => e.phase !== "closed"));
    } finally {
      this.busy = false;
      this.flush();
      this.emit();
    }
  }

  private followUp(): void {
    for (const inv of this.events) {
      if (inv.phase !== "followUp") continue;
      inv.setTime(this.day);
      inv.followUp([...this.cleared]);
      if (inv.outcome !== undefined) {
        this.detector.setEventOpen(this.events.some((e) => e.phase !== "closed"));
        this.speed = Math.max(this.speed, 10);
      }
    }
    this.flush();
  }

  private event(id: string): Investigation {
    const inv = this.events.find((e) => e.eventId === id);
    if (!inv) throw new Error(`unknown event ${id}`);
    return inv;
  }

  /** Appends new log lines to runs/<runId>.jsonl (Q18). */
  private flush(): void {
    for (const inv of this.events) {
      const done = this.written.get(inv.eventId) ?? 0;
      const lines = inv.log.slice(done);
      if (lines.length === 0) continue;
      appendFileSync(this.runFile, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
      this.written.set(inv.eventId, inv.log.length);
    }
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

function media(m: ScenarioMedia): SessionView["testImages"][string] {
  return {
    url: `/api/reference/${m.file}`,
    caption: m.caption,
    label: m.label,
    sourceId: m.sourceId,
  };
}
