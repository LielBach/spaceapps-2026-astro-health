import type { Anchor } from "@astrohealth/core";

// Inspiration4 labs on OSDR: OSD-575 (CMP) and OSD-569 (CBC). Columns:
// ANALYTE,VALUE,RANGE_MIN,RANGE_MAX,UNITS,TEST_TYPE,SUBJECT_ID,SEX,timepoint|TEST_DATE

export const PREFLIGHT_TIMEPOINTS = ["L-92", "L-44", "L-3"] as const;

export function astronautIdI4(subject: string): string {
  return `i4-${subject}`;
}

function slug(analyte: string): string {
  return analyte
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) {
      cells.push(current);
      current = "";
    } else current += ch;
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

export function parseLabCsv(text: string, sourceId: string): Anchor[] {
  const [header, ...lines] = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (!header) return [];
  const cols = splitCsvLine(header).map((h) => h.toUpperCase());
  const at = (name: string) => cols.indexOf(name);
  const iTime = at("TIMEPOINT") >= 0 ? at("TIMEPOINT") : at("TEST_DATE");
  const anchors: Anchor[] = [];
  for (const line of lines) {
    const c = splitCsvLine(line);
    const value = Number(c[at("VALUE")]);
    if (!Number.isFinite(value)) continue;
    const min = Number(c[at("RANGE_MIN")]);
    const max = Number(c[at("RANGE_MAX")]);
    anchors.push({
      astronautId: astronautIdI4(c[at("SUBJECT_ID")] ?? ""),
      measure: slug(c[at("ANALYTE")] ?? ""),
      value,
      unit: c[at("UNITS")] ?? "",
      condition: c[iTime] ?? "",
      label: "REAL",
      ...(Number.isFinite(min) && Number.isFinite(max) && c[at("RANGE_MIN")] !== ""
        ? { range: { min, max } }
        : {}),
      sourceId,
    });
  }
  return anchors;
}

/** The subject with the lowest mean pre-flight albumin (Q30: chooses Maya). */
export function lowestPreflightAlbumin(anchors: Anchor[]): { astronautId: string; mean: number } {
  const bySubject = new Map<string, number[]>();
  for (const a of anchors) {
    if (a.measure !== "albumin") continue;
    if (!(PREFLIGHT_TIMEPOINTS as readonly string[]).includes(a.condition)) continue;
    bySubject.set(a.astronautId, [...(bySubject.get(a.astronautId) ?? []), a.value]);
  }
  let best: { astronautId: string; mean: number } | undefined;
  for (const [astronautId, values] of bySubject) {
    const mean = values.reduce((x, y) => x + y, 0) / values.length;
    if (!best || mean < best.mean) best = { astronautId, mean };
  }
  if (!best) throw new Error("no pre-flight albumin values");
  return best;
}
