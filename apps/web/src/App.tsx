import { useSession } from "./api.ts";
import { Charts } from "./components/Charts.tsx";
import { CmoReview } from "./components/clinical/CmoReview.tsx";
import { EventLog } from "./components/EventLog.tsx";
import { PresenterBar } from "./components/PresenterBar.tsx";
import { MedicalRecord } from "./components/Record.tsx";
import { Label, SourcesContext, Src } from "./components/Source.tsx";
import { Tablet } from "./components/tablet/Tablet.tsx";

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
      <PresenterBar view={view} />
      {astronaut.composite && <p className="composite-note">{astronaut.composite.disclosure}</p>}
      <main className="layout">
        <div className="tablet-col">
          <Tablet view={view} event={event} />
        </div>
        <div className="clinical-col">
          <header className="clinical-head">
            <span className="logo">AstroHealth</span>
            <span className="muted">{scenario.title}</span>
            <span className="astronaut">
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
            </span>
          </header>
          <div className="clinical-grid">
            <CmoReview view={view} event={event} />
            <Charts view={view} />
          </div>
          <MedicalRecord view={view} />
          <EventLog view={view} />
        </div>
      </main>
      <footer className="muted small">
        Decision support only. Suspected diagnoses are for crew medical officer confirmation;
        actions come only from approved pathways. Labels: REAL = published astronaut data, SIMULATED
        = generated from published effect sizes, REFERENCE = published group data.
      </footer>
    </SourcesContext.Provider>
  );
}
