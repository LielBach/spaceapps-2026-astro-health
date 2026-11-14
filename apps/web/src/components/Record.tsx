import type { MediaView, SessionView } from "@astrohealth/core";
import { day } from "../api.ts";
import { Label, Src } from "./Source.tsx";

/** A scan with its own label and credit (ADR 0009). AstroHealth does not read images. */
export function Scan({ media, title }: { media: MediaView; title: string }) {
  return (
    <figure className="scan">
      <a href={media.url} target="_blank" rel="noreferrer">
        <img src={media.url} alt={media.caption} loading="lazy" />
      </a>
      <figcaption>
        <strong>{title}</strong> <Label kind={media.label} />
        <Src id={media.sourceId} />
        <br />
        {media.caption} CC-BY.
      </figcaption>
    </figure>
  );
}

const LAB_NAMES: Record<string, string> = {
  albumin: "Albumin",
  "protein-total": "Total protein",
  hemoglobin: "Hemoglobin",
  hematocrit: "Hematocrit",
  "platelet-count": "Platelets",
  "white-blood-cell-count": "White blood cells",
  sodium: "Sodium",
  potassium: "Potassium",
  "urea-nitrogen-bun": "Urea nitrogen (BUN)",
  creatinine: "Creatinine",
};

/** The imported longitudinal record (Demo 1 step 1): prior scans, real labs, surveillance rules. */
export function MedicalRecord({ view }: { view: SessionView }) {
  const { entries, labs } = view.record;
  if (entries.length === 0 && labs.length === 0) return null;
  const onFile = entries.filter((e) => e.day <= view.day);
  return (
    <section className="panel record">
      <h2>
        Imported record <small>{view.astronaut.displayName}</small>
      </h2>
      {onFile.map((e) => {
        const rule = view.surveillance.find((s) => s.recordEntry === e.id);
        const condition = rule && view.catalog.conditions.find((c) => c.id === rule.conditionId);
        return (
          <div key={e.id} className="record-entry">
            <p>
              <span className="muted">{e.day < 0 ? `Pre-flight (${day(e.day)})` : day(e.day)}</span>{" "}
              <strong>{e.title}</strong> <Label kind={e.label} />
              <Src id={e.sourceId} />
            </p>
            <p>{e.text}</p>
            {rule && (
              <p className="surveillance">
                Surveillance trigger ({condition?.name ?? rule.conditionId}): reassessment due by{" "}
                {day(rule.dueDay)}
                <Src id={rule.sourceId} />
                {rule.openedAt !== undefined &&
                  ` · opened ${day(rule.openedAt)}${
                    rule.openedAt < rule.dueDay
                      ? `, ${(rule.dueDay - rule.openedAt).toFixed(0)} days early`
                      : ""
                  }`}
              </p>
            )}
            {e.image && <Scan media={e.image} title="Earlier scan" />}
          </div>
        );
      })}
      {labs.length > 0 && (
        <>
          <h3>
            Pre-flight labs ({labs[0]?.timepoint}) <Label kind="REAL" />
            {[...new Set(labs.map((l) => l.sourceId))].map((s) => (
              <Src key={s} id={s} />
            ))}
          </h3>
          <table className="labs">
            <tbody>
              {labs.map((l) => {
                const out = l.range && (l.value < l.range.min || l.value > l.range.max);
                return (
                  <tr key={l.measure} className={out ? "out" : undefined}>
                    <td>{LAB_NAMES[l.measure] ?? l.measure}</td>
                    <td className="num">
                      {l.value} <span className="muted">{l.unit}</span>
                    </td>
                    <td className="muted small">
                      {l.range ? `ref. ${l.range.min}–${l.range.max}` : ""}
                      {out ? " · outside range" : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="muted small">
            Reference ranges are the lab&apos;s own, from the source file. The demo does not claim
            that any lab value predicts a clot.
          </p>
        </>
      )}
    </section>
  );
}
