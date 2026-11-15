import { useEffect, useState } from "react";
import type { SessionView } from "@astrohealth/core";
import { post } from "../api.ts";

const SPEEDS = [1, 2, 5, 10, 20, 30];

/** Live branch: a different answer for one question, used by autopilot or the next tap. */
function LiveBranch({ view }: { view: SessionView }) {
  const pending = view.events.find((e) => e.phase !== "closed")?.pending;
  const [questionId, setQuestionId] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const chosen = questionId || (pending?.kind === "question" ? pending.id : "");
  const set = Object.entries(view.overrides);
  return (
    <details className="live-branch">
      <summary>Live branch{set.length > 0 ? ` (${set.length})` : ""}</summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!chosen || !text) {
            setError("Choose a question and enter an answer first.");
            return;
          }
          void post("override", { questionId: chosen, text });
          setText("");
          setError("");
        }}
      >
        <select
          value={chosen}
          onChange={(e) => setQuestionId(e.target.value)}
          aria-label="Question"
        >
          <option value="">Question…</option>
          {view.catalog.questions.map((q) => (
            <option key={q.id} value={q.id}>
              {q.id}
            </option>
          ))}
        </select>
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError("");
          }}
          placeholder="yes"
          aria-label="Answer"
        />
        <button type="submit">Set</button>
        {error && <span className="error">{error}</span>}
      </form>
      {set.length > 0 && (
        <ul>
          {set.map(([q, t]) => (
            <li key={q}>
              {q} → “{t}”{" "}
              <button className="link" onClick={() => void post("override", { questionId: q })}>
                clear
              </button>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

/** Replay controls for the presenter. Not part of the astronaut's tablet. */
export function PresenterBar({ view }: { view: SessionView }) {
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
    <div className="presenter-bar">
      <span className="presenter-tag">Presenter</span>
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
      <select
        value={view.speed}
        onChange={(e) => void post("control", { speed: Number(e.target.value) })}
        aria-label="Speed"
      >
        {SPEEDS.map((s) => (
          <option key={s} value={s}>
            {s} days/min
          </option>
        ))}
      </select>
      <div className="mission-day">
        <span>
          Mission day {view.day.toFixed(1)} / {mission.lengthDays}
        </span>
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
      <LiveBranch view={view} />
      <a
        className="export"
        href="/api/fhir/export"
        download
        title="FHIR R4 Bundle of this run: coded observations, suspected conditions, tasks and provenance"
      >
        Export FHIR
      </a>
      <span className="provider">
        Reasoner:{" "}
        {view.provider === "none" ? "no-LLM fallback" : `${view.provider} ${view.model ?? ""}`}
      </span>
    </div>
  );
}
