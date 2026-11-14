import { useSession } from "./api.ts";
import { Charts } from "./components/Charts.tsx";
import { CheckIn } from "./components/CheckIn.tsx";
import { Diagnoses } from "./components/Diagnoses.tsx";
import { EventLog } from "./components/EventLog.tsx";
import { MedicalRecord } from "./components/Record.tsx";
import { ReplayBar } from "./components/ReplayBar.tsx";
import { Label, SourcesContext, Src } from "./components/Source.tsx";

export function App() {
  const { view, connected } = useSession();
  if (!view)
    return (
      <main className="loading">
        {connected ? "Loading…" : "Connecting to the AstroHealth server…"}
      </main>
    );
  const event = view.events.find((e) => e.phase !== "closed") ?? view.events.at(-1);
  const { astronaut, scenario } = view;
  return (
    <SourcesContext.Provider value={view.sources}>
      <header className="top">
        <div className="brand">
          <span className="logo">AstroHealth</span>
          <span className="muted">{scenario.title}</span>
        </div>
        <div className="astronaut">
          <strong>{astronaut.displayName}</strong>
          {astronaut.composite ? <Label kind="COMPOSITE" /> : <Label kind="REAL" />}
          <span className="small muted">
            anchors:
            {astronaut.anchorSources.map((s) => (
              <Src key={s} id={s} />
            ))}
          </span>
          <span className="small muted">
            {scenario.mission.name} · comm delay {scenario.mission.commDelayMinutes} min
          </span>
        </div>
      </header>
      {astronaut.composite && <p className="composite-note">{astronaut.composite.disclosure}</p>}
      <ReplayBar view={view} />
      <main className="grid">
        <div className="main-col">
          <Charts view={view} />
          <MedicalRecord view={view} />
        </div>
        <div className="side">
          <CheckIn view={view} event={event} />
          <Diagnoses view={view} event={event} />
        </div>
        <EventLog view={view} />
      </main>
      <footer className="muted small">
        Decision support only. Suspected diagnoses are for crew medical officer confirmation;
        actions come only from approved pathways. Labels: REAL = published astronaut data, SIMULATED
        = generated from published effect sizes, REFERENCE = published group data.
      </footer>
    </SourcesContext.Provider>
  );
}
