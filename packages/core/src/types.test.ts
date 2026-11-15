import { describe, expect, it } from "vitest";
import { DATA_LABELS, isCatalogued } from "./index.ts";

describe("core types", () => {
  it("has exactly the three value labels from ADR 0003", () => {
    expect(DATA_LABELS).toEqual(["REAL", "SIMULATED", "REFERENCE"]);
  });

  it("tells catalogued from uncatalogued diagnoses", () => {
    expect(isCatalogued({ conditionId: "vte" })).toBe(true);
    expect(isCatalogued({ uncatalogued: { name: "unknown rash" } })).toBe(false);
  });
});
