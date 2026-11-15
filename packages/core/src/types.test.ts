import { describe, expect, it } from "vitest";
import { DATA_LABELS, isCatalogued, mentions } from "./index.ts";

describe("core types", () => {
  it("has exactly the three value labels from ADR 0003", () => {
    expect(DATA_LABELS).toEqual(["REAL", "SIMULATED", "REFERENCE"]);
  });

  it("tells catalogued from uncatalogued diagnoses", () => {
    expect(isCatalogued({ conditionId: "vte" })).toBe(true);
    expect(isCatalogued({ uncatalogued: { name: "unknown rash" } })).toBe(false);
  });
});

describe("mentions", () => {
  it("finds a keyword unless it follows a negation", () => {
    expect(mentions("i get tired faster", "tired")).toBe(true);
    expect(mentions("not tired at all", "tired")).toBe(false);
    expect(mentions("no fatigue, but tired", "tired")).toBe(true);
    expect(mentions("without any fatigue", "fatigue")).toBe(false);
  });
});
