import type { EventView, SessionView } from "@astrohealth/core";
import { day, post } from "../../api.ts";
import { cmoAlert, confidenceWord, plainList } from "../../flow.ts";
import { AlertBanner } from "../AlertBanner.tsx";
import { Scan } from "../Record.tsx";
import { Label, Src } from "../Source.tsx";

/** Findings that the cited log lines carry, so evidence reads in words, not IDs. */
function evidenceWords(event: EventView, logIds: string[], supports: string[] | undefined): string {
  const ids = logIds.flatMap((id) => {
    const line = event.log.find((l) => l.id === id);
    return (line?.data.findings as string[] | undefined) ?? [];
  });
  const relevant = supports ? ids.filter((f) => supports.includes(f)) : ids;
  return plainList([...new Set(relevant.length > 0 ? relevant : ids)]);
}

function Cites({ ids, against }: { ids: string[]; against?: boolean }) {
  return (
    <>
      {ids.map((id) => (
        <a
          key={id}
          href={`#${id}`}
          className={`cite${against ? " against" : ""}`}
          onClick={() => document.querySelector("details.log")?.setAttribute("open", "")}
        >
          {id.split("-").at(-1)}
        </a>
      ))}
    </>
  );
}

/** What the crew medical officer needs: the alert, the suspected diagnoses, the one action. */
export function CmoReview({ view, event }: { view: SessionView; event: EventView | undefined }) {
  const alert = cmoAlert(view, event);
  const shown = event?.diagnoses.filter((d) => d.visible) ?? [];
  const next = event?.pending;
  const condition = (id: string) => view.catalog.conditions.find((c) => c.id === id);
  const action =
    next?.kind === "action"
      ? condition(next.conditionId)?.actions.find((a) => a.id === next.actionId)
      : undefined;
  const lastStep = event?.log.findLast((l) => ["question", "test", "action"].includes(l.stepType));
  const rationale = typeof lastStep?.data.rationale === "string" ? lastStep.data.rationale : "";
  const scans =
    event?.log.filter((l) => l.stepType === "result" && l.stepId && view.testImages[l.stepId]) ??
    [];
  return (
    <section className="panel cmo">
      <h2>
        Review and approve
        {event && (
          <small>
            {" "}
            {event.id} · {event.trigger} · opened {day(event.openedAt)}
          </small>
        )}
      </h2>
      <AlertBanner alert={alert} />
      {view.reasoning && <p className="reasoning">Reasoner is choosing the next step…</p>}
      {event && rationale && event.phase === "investigating" && (
        <p className="rationale small">
          <span className="muted">Why this step:</span> {rationale}
        </p>
      )}
      {event && (
        <div className="dx">
          <p className="disclaimer">
            Suspected – for crew medical officer confirmation. Decision support only.
          </p>
          {shown.length === 0 && (
            <p className="muted">Not enough evidence yet (minimum-evidence rule, ADR 0005).</p>
          )}
          {event.unranked && shown.length > 0 && (
            <p className="muted small">No-LLM fallback: possible causes, not ranked.</p>
          )}
          <ol>
            {shown.map((d) => {
              const c =
                "conditionId" in d.ref
                  ? condition((d.ref as { conditionId: string }).conditionId)
                  : undefined;
              return (
                <li key={d.name}>
                  <div className="dx-head">
                    <strong>{d.name}</strong>
                    {!d.catalogued && <Label kind="UNCATALOGUED" />}
                    {!event.unranked && (
                      <span className="confidence">
                        {confidenceWord(d.confidence)} · {Math.round(d.confidence * 100)}%
                        <Src id="illustrative" />
                      </span>
                    )}
                  </div>
                  {!event.unranked && (
                    <div className="bar">
                      <div style={{ width: `${d.confidence * 100}%` }} />
                    </div>
                  )}
                  <div className="small">
                    <span className="muted">Why:</span>{" "}
                    {evidenceWords(event, d.evidenceFor, c?.supports)} <Cites ids={d.evidenceFor} />
                    {d.evidenceAgainst.length > 0 && (
                      <>
                        {" · "}
                        <span className="muted">against:</span>{" "}
                        {evidenceWords(event, d.evidenceAgainst, c?.against)}{" "}
                        <Cites ids={d.evidenceAgainst} against />
                      </>
                    )}
                  </div>
                  {c && (
                    <div className="small muted">
                      Hazard: {c.hazard} ·{" "}
                      <a href={c.hrpRiskUrl} target="_blank" rel="noreferrer">
                        {c.hrpRisk}
                      </a>
                      {c.sourceIds.map((s) => (
                        <Src key={s} id={s} />
                      ))}
                      {d.confirmingTest &&
                        ` · confirming test: ${
                          view.catalog.tests.find((t) => t.id === d.confirmingTest)?.name ??
                          d.confirmingTest
                        }`}
                    </div>
                  )}
                  {!d.catalogued && (
                    <div className="small warn">Not from an approved pathway: escalation only.</div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}
      {event && next?.kind === "action" && action && (
        <div className="approve">
          <p className="muted small">
            Recommended action (approved pathway: {condition(next.conditionId)?.name})
          </p>
          <p className="action-text">{action.text}</p>
          <button
            className="big primary"
            onClick={() => void post("approve", { eventId: event.id })}
          >
            Approve
          </button>
          <p className="muted small">
            Ground is {view.scenario.mission.commDelayMinutes} min away one way. You decide.
          </p>
        </div>
      )}
      {scans.map((l) => (
        <Scan
          key={l.id}
          media={view.testImages[l.stepId!]!}
          title={`Today's scan (${day(l.missionDay)})`}
        />
      ))}
    </section>
  );
}
