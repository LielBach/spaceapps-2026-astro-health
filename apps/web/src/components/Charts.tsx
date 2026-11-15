import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MetricId, SessionView } from "@astrohealth/core";
import { Label, Src } from "./Source.tsx";

const METRICS: { id: MetricId; title: string; unit: string; note: string }[] = [
  {
    id: "standardExerciseHr",
    title: "Heart rate at the standard exercise workload",
    unit: "bpm",
    note: "exercise device record at a matched workload",
  },
  { id: "maxWorkload", title: "Max workload test", unit: "W", note: "weekly exercise device test" },
  {
    id: "restingHr",
    title: "Resting heart rate (daily mean)",
    unit: "bpm",
    note: "wearable, rest windows",
  },
  {
    id: "sleepingHr",
    title: "Sleeping heart rate (nightly mean)",
    unit: "bpm",
    note: "wearable, sleep windows",
  },
];

const COLORS = {
  value: "var(--series)",
  baseline: "var(--muted)",
  limit: "var(--warn)",
  bad: "var(--bad)",
};

function EventLines({ view }: { view: SessionView }) {
  return (
    <>
      {view.markers
        .filter((m) => ["open", "surveillance", "action", "urgent"].includes(m.kind))
        .map((m) => (
          <ReferenceLine
            key={`${m.kind}-${m.t}`}
            x={m.t}
            stroke={m.kind === "action" ? "var(--good)" : "var(--bad)"}
            strokeDasharray="4 3"
            label={{
              value: m.kind === "action" ? "action" : "event",
              fill: "var(--muted)",
              fontSize: 10,
              position: "insideTopLeft",
            }}
          />
        ))}
      {view.events
        .filter((e) => e.outcome)
        .map((e) => {
          const close = e.log.at(-1)?.missionDay;
          return close === undefined ? null : (
            <ReferenceLine
              key={`close-${e.id}`}
              x={close}
              stroke={e.outcome === "escalated" ? "var(--bad)" : "var(--good)"}
              label={{
                value: e.outcome ?? "",
                fill: e.outcome === "escalated" ? "var(--bad)" : "var(--good)",
                fontSize: 10,
                position: "insideBottomRight",
              }}
            />
          );
        })}
    </>
  );
}

export function MetricChart({
  view,
  metric,
}: {
  view: SessionView;
  metric: (typeof METRICS)[number];
}) {
  const data = view.points.filter((p) => p.metric === metric.id);
  const last = data.at(-1);
  const { replayFromDay, lengthDays } = view.scenario.mission;
  return (
    <div className="chart">
      <div className="chart-head">
        <span>
          {metric.title} <Label kind="SIMULATED" />
        </span>
        <span className="chart-value">
          {last ? `${last.value} ${metric.unit}` : "—"}
          {last && (
            <small>
              {" "}
              baseline {last.baseline}, band limit {last.limit}
              <Src id="illustrative" />
            </small>
          )}
        </span>
      </div>
      <div className="chart-note">{metric.note}</div>
      <ResponsiveContainer width="100%" height={150}>
        <ComposedChart data={data} margin={{ top: 14, right: 12, bottom: 0, left: -10 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            domain={[replayFromDay - 30, lengthDays]}
            tick={{ fontSize: 10 }}
            tickCount={7}
            tickFormatter={(t: number) => String(Math.round(t))}
          />
          <ReferenceArea
            x1={replayFromDay - 30}
            x2={replayFromDay}
            fill="var(--grid)"
            fillOpacity={0.6}
            label={{
              value: "baseline window",
              fill: "var(--muted)",
              fontSize: 10,
              position: "insideTop",
            }}
          />
          <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10 }} />
          <Tooltip
            formatter={(v: unknown, name: unknown) => [`${String(v)} ${metric.unit}`, String(name)]}
            labelFormatter={(t: unknown) => `Day ${Number(t).toFixed(1)}`}
            contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)" }}
          />
          <Line
            dataKey="baseline"
            name="frozen baseline"
            stroke={COLORS.baseline}
            dot={false}
            type="stepAfter"
            isAnimationActive={false}
          />
          <Line
            dataKey="limit"
            name="band limit"
            stroke={COLORS.limit}
            strokeDasharray="5 4"
            dot={false}
            type="stepAfter"
            isAnimationActive={false}
          />
          <Line
            dataKey="value"
            name={metric.title}
            stroke={COLORS.value}
            isAnimationActive={false}
            dot={(props: {
              cx?: number;
              cy?: number;
              payload?: { deviating: boolean };
              index?: number;
            }) => (
              <circle
                key={props.index}
                cx={props.cx}
                cy={props.cy}
                r={props.payload?.deviating ? 3 : 1.5}
                fill={props.payload?.deviating ? COLORS.bad : COLORS.value}
              />
            )}
          />
          <EventLines view={view} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Raw hourly heart rate, with the benign spikes the context filter ignored. */
export function HeartRateChart({ view }: { view: SessionView }) {
  const from = view.day - 14;
  const data = view.hr.filter((s) => s.t >= from);
  const ignored = view.markers.filter((m) => m.kind === "ignored" && m.t >= from);
  return (
    <div className="chart">
      <div className="chart-head">
        <span>
          Heart rate, hourly (last 14 days) <Label kind="SIMULATED" />
        </span>
        <span className="chart-value">
          {view.hrBaselineSourceId &&
          view.astronaut.anchorSources.includes(view.hrBaselineSourceId) ? (
            <small>
              seeded from the real in-flight resting HR of {view.astronaut.displayName}{" "}
              <Label kind="REAL" />
              <Src id={view.hrBaselineSourceId} />
            </small>
          ) : (
            <small>
              seeded from an example resting HR{" "}
              <Src id={view.hrBaselineSourceId ?? "illustrative"} />
            </small>
          )}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={150}>
        <ComposedChart data={data} margin={{ top: 14, right: 12, bottom: 0, left: -10 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            domain={[from, Math.max(from + 14, view.day)]}
            tick={{ fontSize: 10 }}
            allowDecimals={false}
            tickFormatter={(t: number) => String(Math.round(t))}
          />
          <YAxis domain={[40, "auto"]} tick={{ fontSize: 10 }} />
          <Tooltip
            labelFormatter={(t: unknown) => `Day ${Number(t).toFixed(2)}`}
            contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)" }}
          />
          <Line
            dataKey="value"
            name="HR"
            stroke="var(--series)"
            dot={false}
            strokeWidth={1}
            isAnimationActive={false}
          />
          {ignored.map((m) => {
            const point = data.reduce(
              (a, b) => (Math.abs(b.t - m.t) < Math.abs(a.t - m.t) ? b : a),
              data[0]!,
            );
            return (
              <ReferenceDot
                key={m.t}
                x={point.t}
                y={point.value}
                r={6}
                fill="none"
                stroke="var(--warn)"
                label={{ value: "ignored", fill: "var(--warn)", fontSize: 10, position: "top" }}
              />
            );
          })}
          <EventLines view={view} />
        </ComposedChart>
      </ResponsiveContainer>
      {ignored.length > 0 && (
        <ul className="ignored">
          {ignored.map((m) => (
            <li key={m.t}>
              Day {m.t.toFixed(1)}: {m.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Charts({ view }: { view: SessionView }) {
  return (
    <section className="charts">
      {METRICS.filter((m) => !view.charts || view.charts.includes(m.id)).map((m) => (
        <MetricChart key={m.id} view={view} metric={m} />
      ))}
      <HeartRateChart view={view} />
    </section>
  );
}
