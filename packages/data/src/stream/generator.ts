import type { Anchor, PassiveSignal, Sample, SampleContext } from "@astrohealth/core";
import { gaussian } from "./noise.ts";
import type { Scenario } from "./scenario.ts";

export interface Intervention {
  action: string;
  day: number;
}

export interface Stream {
  /** Samples with from <= t < to, in time order. */
  samplesBetween(fromDay: number, toDay: number, interventions?: Intervention[]): Sample[];
  baseline(signal: PassiveSignal): number;
}

const round = (value: number, digits = 1) => Math.round(value * 10 ** digits) / 10 ** digits;

export function resolveBaseline(
  scenario: Scenario,
  anchors: Anchor[],
  signal: PassiveSignal,
): number {
  const spec = scenario.stream.baselines[signal];
  if (!spec) throw new Error(`scenario ${scenario.id} has no baseline for ${signal}`);
  if (typeof spec.value === "number") return spec.value;
  const { measure, condition } = spec.value.anchor;
  const anchor = anchors.find(
    (a) =>
      a.astronautId === scenario.astronaut.id && a.measure === measure && a.condition === condition,
  );
  if (!anchor) throw new Error(`no anchor ${scenario.astronaut.id} ${measure} ${condition}`);
  return anchor.value;
}

export function createStream(scenario: Scenario, anchors: Anchor[]): Stream {
  const { stream, seed } = scenario;
  const step = stream.sampleEveryHours / 24;
  const base = (signal: PassiveSignal) => resolveBaseline(scenario, anchors, signal);
  const restHr = base("hr");
  const sourceOf = (signal: PassiveSignal) => stream.baselines[signal]?.sourceId ?? "illustrative";

  function contextAt(t: number): { context: SampleContext; spikes: Scenario["spikes"] } {
    const day = Math.floor(t);
    const hour = round((t - day) * 24, 3);
    const spikes = scenario.spikes.filter((s) => t >= s.day && t < s.day + s.hours / 24);
    if (spikes[0]) return { context: spikes[0].context, spikes };
    const [sleepStart, sleepEnd] = stream.sleepHours;
    const asleep =
      sleepStart > sleepEnd
        ? hour >= sleepStart || hour < sleepEnd
        : hour >= sleepStart && hour < sleepEnd;
    if (asleep) return { context: "sleep", spikes };
    if (Math.abs(hour - stream.exercise.standardSessionHour) < 1e-6) {
      const isMax = day > 0 && day % stream.exercise.maxTestEveryDays === 0;
      return { context: isMax ? "exercise-max" : "exercise-standard", spikes };
    }
    return { context: "rest", spikes };
  }

  function drift(
    signal: PassiveSignal,
    context: SampleContext,
    t: number,
    interventions: Intervention[],
  ): number {
    let total = 0;
    for (const d of scenario.drifts) {
      if (d.signal !== signal || (d.context && d.context !== context) || t < d.fromDay) continue;
      let amount = d.delta * Math.min(1, (t - d.fromDay) / Math.max(d.toDay - d.fromDay, 1e-9));
      const reversal = d.reversedBy;
      const applied =
        reversal && interventions.find((i) => i.action === reversal.action && i.day >= d.fromDay);
      if (reversal && applied && t > applied.day) {
        amount *= Math.max(0, 1 - (t - applied.day) / reversal.overDays);
      }
      total += amount;
    }
    return total;
  }

  function sample(signal: PassiveSignal, t: number, value: number, context: SampleContext): Sample {
    return {
      t: round(t, 4),
      signal,
      value,
      quality: 1,
      label: "SIMULATED",
      sourceId: sourceOf(signal),
      context,
    };
  }

  function at(t: number, interventions: Intervention[]): Sample[] {
    const { context, spikes } = contextAt(t);
    const noise = (signal: PassiveSignal) =>
      (stream.baselines[signal]?.noiseSd ?? 0) * gaussian(seed, signal, t);
    const spike = (signal: PassiveSignal) =>
      spikes.filter((s) => s.signal === signal).reduce((x, s) => x + s.delta, 0);
    const out: Sample[] = [];

    let hr = restHr + noise("hr") + drift("hr", context, t, interventions) + spike("hr");
    if (context === "sleep") hr -= stream.sleepHrDrop;
    const exercising = context === "exercise-standard" || context === "exercise-max";
    if (exercising) {
      const workload =
        context === "exercise-max"
          ? stream.exercise.maxTestBaselineWatts +
            drift("exerciseWorkload", context, t, interventions)
          : stream.exercise.standardWorkloadWatts;
      const exerciseHr =
        restHr * stream.exerciseHrRatio +
        noise("hr") +
        drift("exerciseHr", context, t, interventions);
      hr = exerciseHr;
      out.push(sample("exerciseWorkload", t, round(workload), context));
      out.push(sample("exerciseHr", t, round(exerciseHr), context));
    }
    out.push(sample("hr", t, round(hr), context));

    for (const signal of ["hrv", "respiratoryRate", "skinTemp", "spo2"] as const) {
      if (!stream.baselines[signal]) continue;
      let value =
        base(signal) + noise(signal) + drift(signal, context, t, interventions) + spike(signal);
      if (signal === "hrv" && context === "sleep") value += 8;
      if (signal === "spo2") value = Math.min(100, value);
      out.push(sample(signal, t, round(value), context));
    }
    const activity = {
      sleep: 0.02,
      rest: 0.2,
      "exercise-standard": 0.8,
      "exercise-max": 0.95,
      "exercise-free": 0.75,
    }[context];
    out.push(
      sample("activity", t, round(activity + 0.03 * gaussian(seed, "activity", t), 2), context),
    );
    return out;
  }

  return {
    baseline: base,
    samplesBetween(fromDay, toDay, interventions = []) {
      const out: Sample[] = [];
      const first = Math.ceil(round(fromDay / step, 6)) * step;
      for (let t = first; t < toDay - 1e-9; t += step) out.push(...at(round(t, 6), interventions));
      return out;
    },
  };
}
