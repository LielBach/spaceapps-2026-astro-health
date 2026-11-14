import { createContext, useContext } from "react";
import type { SourceView } from "@astrohealth/core";

export const SourcesContext = createContext<SourceView[]>([]);

/** Source link for a number (CLAUDE.md: every number shown carries a source). */
export function Src({ id }: { id: string }) {
  const source = useContext(SourcesContext).find((s) => s.id === id);
  if (!source) return <sup className="src missing">[unknown source {id}]</sup>;
  const title = `${source.title}${source.note ? ` — ${source.note}` : ""}`;
  return (
    <sup className={`src${source.verify ? " verify" : ""}`} title={title}>
      {source.url ? (
        <a href={source.url} target="_blank" rel="noreferrer">
          [{source.id}]
        </a>
      ) : (
        `[${source.id}]`
      )}
      {source.verify ? " (verify)" : ""}
    </sup>
  );
}

export function Label({
  kind,
}: {
  kind: "REAL" | "SIMULATED" | "REFERENCE" | "COMPOSITE" | "UNCATALOGUED";
}) {
  return <span className={`label label-${kind.toLowerCase()}`}>{kind}</span>;
}
