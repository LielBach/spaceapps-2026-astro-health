import { useEffect, useState } from "react";
import type { SessionView } from "@astrohealth/core";
import { post } from "../api.ts";

const SPEEDS = [1, 2, 5, 10, 20, 30];

export function ReplayBar({ view }: { view: SessionView }) {
  const [scenarios, setScenarios] = useState<string[]>([]);
  useEffect(() => {
    fetch("/api/scenarios")
      .then((r) => r.json() as Promise<{ scenarios: string[] }>)
      .then((r) => setScenarios(r.scenarios))
      .catch(() => undefined);
  }, []);
  const { mission } = view.scenario;
  const progress =
    (view.day - mission.replayFromDay) / (mission.lengthDays - mission.replayFromDay);
  return (
    <div className="replay-bar">
      <select
        value={view.scenario.id}
        onChange={(e) => void post("control", { scenario: e.target.value })}
        aria-label="Demo"
      >
        {scenarios.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <button className="primary" onClick={() => void post("control", { playing: !view.playing })}>
        {view.playing ? "Pause" : "Play"}
      </button>
      <button onClick={() => void post("control", { reset: true })}>Restart</button>
      <label>
        Speed
        <select
          value={view.speed}
          onChange={(e) => void post("control", { speed: Number(e.target.value) })}
        >
          {SPEEDS.map((s) => (
            <option key={s} value={s}>
              {s} days/min
            </option>
          ))}
        </select>
      </label>
      <div className="mission-day">
        <strong>Mission day {view.day.toFixed(1)}</strong> / {mission.lengthDays}
        <div className="progress">
          <div style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }} />
        </div>
      </div>
      {view.waiting && <span className="waiting">Waiting for the crew</span>}
      <label className="toggle">
        <input
          type="checkbox"
          checked={view.blackout}
          onChange={(e) => void post("control", { blackout: e.target.checked })}
        />
        Comm blackout
      </label>
      <label className="toggle">
        <input
          type="checkbox"
          checked={view.autopilot}
          onChange={(e) => void post("control", { autopilot: e.target.checked })}
        />
        Autopilot
      </label>
      <span className="provider">
        Reasoner: {view.provider === "none" ? "no-LLM fallback" : view.provider}
      </span>
    </div>
  );
}
