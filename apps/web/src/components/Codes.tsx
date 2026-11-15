import {
  SYSTEM_NAMES,
  codeUrl,
  type Equivalence,
  type Mapping,
  type MeasureDef,
} from "@astrohealth/core";

const EQUIVALENCE_WORDS: Record<Exclude<Equivalence, "equivalent" | "unmatched">, string> = {
  wider: "nearest code (broader)",
  narrower: "nearest code (narrower)",
  inexact: "nearest code (overlaps)",
};

/**
 * Standard codes of a measure, finding or condition (docs/technical/10 §4.9). A code that is not
 * an exact match says so; an unmatched mapping says that no standard code exists.
 */
export function Codes({ mappings, compact = false }: { mappings: Mapping[]; compact?: boolean }) {
  const shown = compact ? mappings.slice(0, 1) : mappings;
  return (
    <span className="codes">
      {shown.map((m) => {
        const system = SYSTEM_NAMES[m.system];
        if (m.equivalence === "unmatched")
          return (
            <span key={`${m.system}-none`} className="code unmatched" title={m.note}>
              no {system} code
            </span>
          );
        const url = codeUrl(m);
        const words = m.equivalence === "equivalent" ? "" : EQUIVALENCE_WORDS[m.equivalence];
        const title = [`${system} ${m.code}: ${m.display}`, words, m.note]
          .filter(Boolean)
          .join(" — ");
        const text = `${m.equivalence === "equivalent" ? "" : "≈ "}${system} ${m.code}`;
        return url ? (
          <a
            key={`${m.system}-${m.code}`}
            className={`code ${m.equivalence}`}
            href={url}
            target="_blank"
            rel="noreferrer"
            title={title}
          >
            {text}
          </a>
        ) : (
          <span key={`${m.system}-${m.code}`} className={`code ${m.equivalence}`} title={title}>
            {text}
          </span>
        );
      })}
    </span>
  );
}

/** The measure's codes, or "AstroHealth code" when the registry has no entry. */
export function MeasureCodes({
  measure,
  compact = false,
}: {
  measure: MeasureDef | undefined;
  compact?: boolean;
}) {
  if (!measure) return <span className="code unmatched">not in the measure registry</span>;
  return <Codes mappings={measure.mappings} compact={compact} />;
}
