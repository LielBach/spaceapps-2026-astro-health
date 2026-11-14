import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  lowestPreflightAlbumin,
  parseLabCsv,
  parseRestingTable,
  parseSlopeTable,
  parseStandTest,
} from "../index.ts";

const raw = (file: string) =>
  readFileSync(fileURLToPath(new URL(`../../../../data/raw/${file}`, import.meta.url)));

const find = (
  anchors: ReturnType<typeof parseRestingTable>,
  astronautId: string,
  measure: string,
  condition: string,
) =>
  anchors.find(
    (a) => a.astronautId === astronautId && a.measure === measure && a.condition === condition,
  );

describe("NLSP 178066 (Alex = subject 1)", () => {
  const anchors = parseRestingTable(raw("nlsp-178066-table2-resting.xlsx"));

  it("parses 6 subjects × 3 conditions × 7 measures", () => {
    expect(anchors).toHaveLength(126);
  });

  it("matches the source table for subject 1", () => {
    expect(find(anchors, "nlsp178066-s1", "hr", "preflight-erect")?.value).toBe(80);
    expect(find(anchors, "nlsp178066-s1", "hr", "inflight")?.value).toBe(66);
    expect(find(anchors, "nlsp178066-s1", "sbp", "inflight")?.value).toBe(127);
    expect(find(anchors, "nlsp178066-s1", "dbp", "inflight")?.value).toBe(74);
    expect(find(anchors, "nlsp178066-s1", "stroke-volume", "inflight")?.value).toBe(117);
    expect(find(anchors, "nlsp178066-s1", "cardiac-output", "preflight-supine")?.value).toBe(8.4);
    expect(anchors.every((a) => a.label === "REAL")).toBe(true);
  });

  it("keeps the in-flight HR slope as a REFERENCE group value", () => {
    const slopes = parseSlopeTable(raw("nlsp-178066-table3-slopes.xlsx"));
    const hr = slopes.find(
      (a) => a.measure === "hr-slope-normalized" && a.condition === "inflight",
    );
    expect(hr?.value).toBe(2.1);
    expect(hr?.label).toBe("REFERENCE");
  });
});

describe("DSO 402 reference band", () => {
  const anchors = parseStandTest(raw("nlsp-dso-402-stand-test.xls"));

  it("parses 26 subjects × 12 values, all REFERENCE", () => {
    expect(anchors).toHaveLength(26 * 12);
    expect(anchors.every((a) => a.label === "REFERENCE")).toBe(true);
  });

  it("matches the source table for subject 1", () => {
    const s1 = anchors.filter((a) => a.astronautId === "dso402-s01");
    expect(s1.find((a) => a.measure === "hr" && a.condition === "postflight-standing")?.value).toBe(
      99,
    );
  });
});

describe("Inspiration4 labs (Maya)", () => {
  const cmp = parseLabCsv(raw("osdr-osd-575-cmp.csv").toString("utf8"), "osdr-osd-575");

  it("parses CMP values with reference ranges", () => {
    const glucose = cmp.find(
      (a) => a.astronautId === "i4-C001" && a.measure === "glucose" && a.condition === "L-92",
    );
    expect(glucose).toMatchObject({ value: 83, unit: "mg/dL", range: { min: 65, max: 99 } });
  });

  it("parses the CBC file", () => {
    const cbc = parseLabCsv(raw("osdr-osd-569-cbc.csv").toString("utf8"), "osdr-osd-569");
    const wbc = cbc.find(
      (a) =>
        a.astronautId === "i4-C001" &&
        a.measure === "white-blood-cell-count" &&
        a.condition === "L-92",
    );
    expect(wbc?.value).toBe(5.4);
  });

  it("chooses the subject with the lowest mean pre-flight albumin", () => {
    const pick = lowestPreflightAlbumin(cmp);
    expect(pick.astronautId).toMatch(/^i4-C00[1-4]$/);
    expect(pick.mean).toBeLessThan(5);
  });
});
