import type { EventView, SessionView } from "@orbivit/core";
import { Codes } from "./Codes.tsx";
import { Label, Src } from "./Source.tsx";

/** FHIR R4 Condition.verificationStatus in words (docs/technical/10 rule 8). */
const STATUS_WORDS = {
  provisional: "provisional – for crew medical officer confirmation",
  differential: "differential",
} as const;

export function Diagnoses({ view, event }: { view: SessionView; event: EventView | undefined }) {
  const shown = event?.diagnoses.filter((d) => d.visible) ?? [];
  return (
    <section className="panel diagnoses">
      <h2>Suspected diagnoses</h2>
      <p className="disclaimer">
        Suspected – for crew medical officer confirmation. Decision support only.
      </p>
      {shown.length === 0 && (
        <p className="muted">
          {event ? "Not enough evidence yet (minimum-evidence rule, ADR 0005)." : "No open event."}
        </p>
      )}
      {event?.unranked && shown.length > 0 && (
        <p className="muted small">No-LLM fallback: possible causes, not ranked by confidence.</p>
      )}
      <ol>
        {shown.map((d) => {
          const condition =
            "conditionId" in d.ref
              ? view.catalog.conditions.find(
                  (c) => c.id === (d.ref as { conditionId: string }).conditionId,
                )
              : undefined;
          return (
            <li key={d.name}>
              <div className="dx-head">
                <strong>{d.name}</strong>
                {!d.catalogued && <Label kind="UNCATALOGUED" />}
                <span className={`status-chip ${d.verificationStatus}`}>
                  {STATUS_WORDS[d.verificationStatus]}
                </span>
                {!event?.unranked && (
                  <span className="confidence">{Math.round(d.confidence * 100)}%</span>
                )}
              </div>
              {!event?.unranked && (
                <div className="bar">
                  <div style={{ width: `${d.confidence * 100}%` }} />
                </div>
              )}
              {condition && (
                <div className="small muted">
                  Hazard: {condition.hazard} ·{" "}
                  <a href={condition.hrpRiskUrl} target="_blank" rel="noreferrer">
                    {condition.hrpRisk}
                  </a>
                  {condition.sourceIds.map((s) => (
                    <Src key={s} id={s} />
                  ))}
                  <br />
                  Codes: <Codes mappings={condition.codes} />
                </div>
              )}
              {!d.catalogued && (
                <div className="small warn">Not from an approved pathway: escalation only.</div>
              )}
              <div className="small">
                Evidence for:{" "}
                {d.evidenceFor.map((id) => (
                  <a key={id} href={`#${id}`} className="cite">
                    {id.split("-").at(-1)}
                  </a>
                ))}
                {d.evidenceAgainst.length > 0 && (
                  <>
                    {" "}
                    · against:{" "}
                    {d.evidenceAgainst.map((id) => (
                      <a key={id} href={`#${id}`} className="cite against">
                        {id.split("-").at(-1)}
                      </a>
                    ))}
                  </>
                )}
                {d.confirmingTest && (
                  <span className="muted">
                    {" "}
                    · confirming test:{" "}
                    {view.catalog.tests.find((t) => t.id === d.confirmingTest)?.name ??
                      d.confirmingTest}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
