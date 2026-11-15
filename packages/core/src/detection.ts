// Detection engine (plan §5.3, Q16, ADR 0007). Pure: feed samples in time order, get outputs.
import type { PassiveSignal, Sample, SampleContext } from "./types.ts";

export type MetricId =
  | "sleepingHr"
  | "restingHr"
  | "sleepHrv"
  | "sleepSkinTemp"
  | "sleepRespiratoryRate"
  | "standardExerciseHr"
  | "maxWorkload";

export interface MetricSpec {
  id: MetricId;
  signal: PassiveSignal;
  contexts: SampleContext[];
  /** daily = one value per mission day; session = one value per matching sample. */
  cadence: "daily" | "session";
  direction: "up" | "down";
  /** Allowed distance from the frozen baseline before a window counts as deviating. */
  band: { absolute?: number; fraction?: number };
  finding: string;
  /** Windows in a row that must deviate (persistence filter). */
  persistence: number;
}

export interface DetectionConfig {
  /** Mission days [from, to) used to compute the frozen personal baseline. */
  baselineDays: [number, number];
  metrics: MetricSpec[];
  /** Critical thresholds that skip every other filter. */
  urgent: { restingHrAbove: number; spo2Below: number };
  /** Size of an hourly heart-rate jump that the context filter reports as ignored. */
  transientHrJump: number;
  baselineUpdate: { everyDays: number; maxChangeFraction: number };
  sourceId: string;
}

/** Illustrative parameters (sources.json: "illustrative") until a source is found. */
export const DEFAULT_DETECTION: Omit<DetectionConfig, "baselineDays"> = {
  metrics: [
    {
      id: "sleepingHr",
      signal: "hr",
      contexts: ["sleep"],
      cadence: "daily",
      direction: "up",
      band: { absolute: 6 },
      finding: "f-sleeping-hr-up",
      persistence: 3,
    },
    {
      id: "restingHr",
      signal: "hr",
      contexts: ["rest"],
      cadence: "daily",
      direction: "up",
      band: { absolute: 8 },
      finding: "f-resting-hr-up",
      persistence: 3,
    },
    {
      id: "sleepHrv",
      signal: "hrv",
      contexts: ["sleep"],
      cadence: "daily",
      direction: "down",
      band: { fraction: 0.2 },
      finding: "f-hrv-down",
      persistence: 3,
    },
    {
      id: "sleepSkinTemp",
      signal: "skinTemp",
      contexts: ["sleep"],
      cadence: "daily",
      direction: "up",
      band: { absolute: 0.6 },
      finding: "f-skin-temp-up",
      persistence: 2,
    },
    {
      id: "sleepRespiratoryRate",
      signal: "respiratoryRate",
      contexts: ["sleep"],
      cadence: "daily",
      direction: "up",
      band: { absolute: 3 },
      finding: "f-rr-up",
      persistence: 2,
    },
    {
      id: "standardExerciseHr",
      signal: "exerciseHr",
      contexts: ["exercise-standard"],
      cadence: "session",
      direction: "up",
      band: { absolute: 8 },
      finding: "f-exercise-hr-up",
      persistence: 4,
    },
    {
      id: "maxWorkload",
      signal: "exerciseWorkload",
      contexts: ["exercise-max"],
      cadence: "session",
      direction: "down",
      band: { fraction: 0.08 },
      finding: "f-max-workload-down",
      persistence: 2,
    },
  ],
  urgent: { restingHrAbove: 150, spo2Below: 90 },
  transientHrJump: 15,
  baselineUpdate: { everyDays: 7, maxChangeFraction: 0.02 },
  sourceId: "illustrative",
};

export type DetectionOutput =
  | { kind: "baselineFrozen"; t: number; baselines: Partial<Record<MetricId, number>> }
  /** A metric value inside the baseline window, before the baseline is frozen. */
  | { kind: "baselineWindow"; t: number; metric: MetricId; value: number }
  | { kind: "ignored"; t: number; signal: PassiveSignal; value: number; reason: string }
  | {
      kind: "deviation";
      t: number;
      metric: MetricId;
      finding: string;
      value: number;
      baseline: number;
      limit: number;
      streak: number;
    }
  | { kind: "inBand"; t: number; metric: MetricId; value: number; baseline: number; limit: number }
  | { kind: "watch"; t: number; finding: string; metric: MetricId }
  | { kind: "open"; t: number; findings: string[]; context: string[] }
  | { kind: "cleared"; t: number; finding: string; metric: MetricId }
  | { kind: "urgent"; t: number; finding: string; signal: PassiveSignal; value: number }
  | { kind: "baselineUpdated"; t: number; metric: MetricId; from: number; to: number };

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? (s[m] ?? NaN) : ((s[m - 1] ?? NaN) + (s[m] ?? NaN)) / 2;
};
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const round1 = (x: number) => Math.round(x * 10) / 10;

export function limitFor(spec: MetricSpec, baseline: number): number {
  const width = (spec.band.absolute ?? 0) + Math.abs(baseline) * (spec.band.fraction ?? 0);
  return spec.direction === "up" ? baseline + width : baseline - width;
}

export function isDeviating(spec: MetricSpec, baseline: number, value: number): boolean {
  const limit = limitFor(spec, baseline);
  return spec.direction === "up" ? value > limit : value < limit;
}

export class Detector {
  private readonly config: DetectionConfig;
  private day: number | undefined;
  private dayValues = new Map<MetricId, number[]>();
  private baselineValues = new Map<MetricId, number[]>();
  private baselines = new Map<MetricId, number>();
  private recent = new Map<MetricId, number[]>();
  private frozen = false;
  private streaks = new Map<MetricId, number>();
  private clearStreaks = new Map<MetricId, number>();
  private persistent = new Set<string>();
  private eventOpen = false;
  private lastIgnoredT = -Infinity;
  private lastUrgentT = -Infinity;
  private lastUpdateDay = -Infinity;
  private lastHrByContext = new Map<SampleContext, number>();

  constructor(config: DetectionConfig) {
    this.config = config;
  }

  /** The caller tells the detector when an event is open; baselines never update during one (ADR 0007). */
  setEventOpen(open: boolean): void {
    this.eventOpen = open;
    if (!open) this.persistent.clear();
  }

  baseline(metric: MetricId): number | undefined {
    return this.baselines.get(metric);
  }

  limit(metric: MetricId): number | undefined {
    const spec = this.config.metrics.find((m) => m.id === metric);
    const base = this.baselines.get(metric);
    return spec && base !== undefined ? limitFor(spec, base) : undefined;
  }

  ingest(samples: Sample[]): DetectionOutput[] {
    const out: DetectionOutput[] = [];
    for (const s of samples) {
      const day = Math.floor(s.t);
      if (this.day !== undefined && day > this.day) out.push(...this.closeDay(this.day, s.t));
      this.day = day;
      if (s.quality < 0.5) {
        out.push({
          kind: "ignored",
          t: s.t,
          signal: s.signal,
          value: s.value,
          reason: "low signal quality",
        });
        continue;
      }
      out.push(...this.urgentCheck(s));
      out.push(...this.contextFilter(s));
      for (const spec of this.config.metrics) {
        if (spec.signal !== s.signal || !s.context || !spec.contexts.includes(s.context)) continue;
        if (spec.cadence === "daily") {
          this.dayValues.set(spec.id, [...(this.dayValues.get(spec.id) ?? []), s.value]);
        } else {
          out.push(...this.window(spec, s.value, s.t));
        }
      }
    }
    return out;
  }

  private urgentCheck(s: Sample): DetectionOutput[] {
    const { urgent } = this.config;
    const atRest = s.context === "rest" || s.context === "sleep";
    const hit =
      (s.signal === "hr" && atRest && s.value > urgent.restingHrAbove && "f-resting-hr-critical") ||
      (s.signal === "spo2" && atRest && s.value < urgent.spo2Below && "f-spo2-low");
    if (!hit || s.t - this.lastUrgentT < 0.25) return [];
    this.lastUrgentT = s.t;
    return [{ kind: "urgent", t: s.t, finding: hit, signal: s.signal, value: s.value }];
  }

  private contextFilter(s: Sample): DetectionOutput[] {
    if (s.signal !== "hr" || !s.context) return [];
    const reference = this.baselines.get("restingHr");
    const previous = this.lastHrByContext.get("rest");
    if (s.context === "rest") this.lastHrByContext.set("rest", s.value);
    if (reference === undefined || s.t - this.lastIgnoredT < 0.2) return [];
    const jump = s.value - reference;
    if (s.context === "exercise-free" && jump > this.config.transientHrJump) {
      this.lastIgnoredT = s.t;
      return [
        {
          kind: "ignored",
          t: s.t,
          signal: "hr",
          value: s.value,
          reason: "context filter: unscheduled exercise",
        },
      ];
    }
    if (
      s.context === "rest" &&
      jump > this.config.transientHrJump &&
      (previous ?? reference) - reference < this.config.transientHrJump
    ) {
      this.lastIgnoredT = s.t;
      return [
        {
          kind: "ignored",
          t: s.t,
          signal: "hr",
          value: s.value,
          reason: "persistence filter: single spike at rest",
        },
      ];
    }
    return [];
  }

  private closeDay(day: number, t: number): DetectionOutput[] {
    const out: DetectionOutput[] = [];
    const [from, to] = this.config.baselineDays;
    for (const spec of this.config.metrics) {
      if (spec.cadence !== "daily") continue;
      const values = this.dayValues.get(spec.id);
      if (!values?.length) continue;
      out.push(...this.window(spec, round1(mean(values)), day + 1));
    }
    this.dayValues.clear();
    if (!this.frozen && day + 1 >= to) {
      this.frozen = true;
      for (const spec of this.config.metrics) {
        const values = this.baselineValues.get(spec.id);
        if (values?.length) this.baselines.set(spec.id, round1(median(values)));
      }
      out.push({
        kind: "baselineFrozen",
        t: day + 1,
        baselines: Object.fromEntries(this.baselines),
      });
    }
    if (this.frozen && day + 1 >= from) out.push(...this.maybeUpdateBaselines(day + 1));
    void t;
    return out;
  }

  private window(spec: MetricSpec, value: number, t: number): DetectionOutput[] {
    const [from, to] = this.config.baselineDays;
    if (!this.frozen) {
      if (t >= from && t <= to) {
        this.baselineValues.set(spec.id, [...(this.baselineValues.get(spec.id) ?? []), value]);
        return [{ kind: "baselineWindow", t, metric: spec.id, value }];
      }
      return [];
    }
    const base = this.baselines.get(spec.id);
    if (base === undefined) return [];
    const out: DetectionOutput[] = [];
    this.recent.set(spec.id, [...(this.recent.get(spec.id) ?? []), value].slice(-14));
    if (isDeviating(spec, base, value)) {
      const streak = (this.streaks.get(spec.id) ?? 0) + 1;
      this.streaks.set(spec.id, streak);
      this.clearStreaks.set(spec.id, 0);
      out.push({
        kind: "deviation",
        t,
        metric: spec.id,
        finding: spec.finding,
        value,
        baseline: base,
        limit: round1(limitFor(spec, base)),
        streak,
      });
      if (streak >= spec.persistence && !this.persistent.has(spec.finding)) {
        this.persistent.add(spec.finding);
        out.push({ kind: "watch", t, finding: spec.finding, metric: spec.id });
        if (!this.eventOpen && this.persistent.size >= 2) {
          const context: string[] = [];
          const rest = this.baselines.get("restingHr");
          const lastRest = this.recent.get("restingHr")?.at(-1);
          const restSpec = this.config.metrics.find((m) => m.id === "restingHr");
          if (
            rest !== undefined &&
            lastRest !== undefined &&
            restSpec &&
            !isDeviating(restSpec, rest, lastRest)
          ) {
            context.push("f-resting-hr-in-band");
          }
          out.push({ kind: "open", t, findings: [...this.persistent], context });
        }
      }
    } else {
      this.streaks.set(spec.id, 0);
      out.push({
        kind: "inBand",
        t,
        metric: spec.id,
        value,
        baseline: base,
        limit: round1(limitFor(spec, base)),
      });
      if (this.persistent.has(spec.finding)) {
        const clear = (this.clearStreaks.get(spec.id) ?? 0) + 1;
        this.clearStreaks.set(spec.id, clear);
        if (clear >= spec.persistence) {
          this.persistent.delete(spec.finding);
          out.push({ kind: "cleared", t, finding: spec.finding, metric: spec.id });
        }
      }
    }
    return out;
  }

  /** ADR 0007: update only with no open event and no persistent deviation, capped per update. */
  private maybeUpdateBaselines(day: number): DetectionOutput[] {
    const { everyDays, maxChangeFraction } = this.config.baselineUpdate;
    if (day - this.lastUpdateDay < everyDays) return [];
    this.lastUpdateDay = day;
    if (this.eventOpen || this.persistent.size > 0) return [];
    const out: DetectionOutput[] = [];
    for (const spec of this.config.metrics) {
      const base = this.baselines.get(spec.id);
      const recent = this.recent.get(spec.id);
      if (base === undefined || !recent?.length) continue;
      const target = median(recent);
      const cap = Math.abs(base) * maxChangeFraction;
      const next = round1(base + Math.max(-cap, Math.min(cap, target - base)));
      if (next !== base) {
        this.baselines.set(spec.id, next);
        out.push({ kind: "baselineUpdated", t: day, metric: spec.id, from: base, to: next });
      }
    }
    return out;
  }
}
