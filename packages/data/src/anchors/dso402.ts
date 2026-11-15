import type { Anchor } from "@astrohealth/core";
import { num, readRows } from "./sheet.ts";

// NLSP DSO 402 (Shuttle): individual stand-test results before and after flight. REFERENCE band only.
export const NLSP_DSO_402 = "nlsp-dso-402";

const COLUMNS: [number, string, string][] = [
  [3, "hr", "preflight-supine"],
  [4, "sbp", "preflight-supine"],
  [5, "dbp", "preflight-supine"],
  [6, "hr", "preflight-standing"],
  [7, "sbp", "preflight-standing"],
  [8, "dbp", "preflight-standing"],
  [9, "hr", "postflight-supine"],
  [10, "sbp", "postflight-supine"],
  [11, "dbp", "postflight-supine"],
  [12, "hr", "postflight-standing"],
  [13, "sbp", "postflight-standing"],
  [14, "dbp", "postflight-standing"],
];

export function parseStandTest(bytes: Uint8Array): Anchor[] {
  const anchors: Anchor[] = [];
  for (const row of readRows(bytes)) {
    if (typeof row[0] !== "number") continue;
    const astronautId = `dso402-s${String(row[0]).padStart(2, "0")}`;
    for (const [col, measure, condition] of COLUMNS) {
      anchors.push({
        astronautId,
        measure,
        value: num(row[col]),
        unit: measure === "hr" ? "bpm" : "mmHg",
        condition,
        label: "REFERENCE",
        sourceId: NLSP_DSO_402,
      });
    }
  }
  return anchors;
}
