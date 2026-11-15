import type { Anchor } from "@orbivit/core";
import { bp, num, readRows } from "./sheet.ts";

// NLSP 178066, Shykoff et al. 1996 (STS-40/58). Table 2: average resting data by subject.
const SECTIONS: Record<string, string> = {
  "preflight erect": "preflight-erect",
  "in flight": "inflight",
  "preflight supine": "preflight-supine",
};

export const NLSP_178066 = "nlsp-178066";

export function astronautId178066(subject: number): string {
  return `nlsp178066-s${subject}`;
}

export function parseRestingTable(bytes: Uint8Array): Anchor[] {
  const anchors: Anchor[] = [];
  let condition: string | undefined;
  for (const row of readRows(bytes)) {
    const heading = String(row[2] ?? "")
      .trim()
      .toLowerCase();
    if (row[0] === "" && heading in SECTIONS) {
      condition = SECTIONS[heading];
      continue;
    }
    if (typeof row[0] !== "number" || !condition) continue;
    const astronautId = astronautId178066(row[0]);
    const [sbp, dbp] = bp(row[3]);
    const values: [string, number, string][] = [
      ["cardiac-output", num(row[1]), "L/min"],
      ["hr", num(row[2]), "bpm"],
      ["sbp", sbp, "mmHg"],
      ["dbp", dbp, "mmHg"],
      ["map", num(row[4]), "mmHg"],
      ["stroke-volume", num(row[5]), "mL"],
      ["frc", num(row[6]), "L"],
    ];
    for (const [measure, value, unit] of values) {
      anchors.push({
        astronautId,
        measure,
        value,
        unit,
        condition,
        label: "REAL",
        sourceId: NLSP_178066,
      });
    }
  }
  return anchors;
}

/** Table 3: group regression slopes vs workload, normalized by the resting value. REFERENCE only. */
export function parseSlopeTable(bytes: Uint8Array): Anchor[] {
  const conditions = ["preflight-erect", "inflight", "preflight-supine"];
  const anchors: Anchor[] = [];
  for (const row of readRows(bytes)) {
    const variable = String(row[0] ?? "").trim();
    if (!["Q", "MAP", "RQ", "HR", "VE", "VT"].includes(variable)) continue;
    conditions.forEach((condition, i) => {
      const base = 1 + i * 3;
      for (const [suffix, cell] of [
        ["", row[base]],
        ["-se", row[base + 2]],
      ] as const) {
        anchors.push({
          astronautId: "nlsp178066-group",
          measure: `${variable.toLowerCase()}-slope-normalized${suffix}`,
          value: num(cell),
          unit: "1/workload (normalized)",
          condition,
          label: "REFERENCE",
          sourceId: NLSP_178066,
        });
      }
    });
  }
  return anchors;
}
