import { readFileSync } from "node:fs";
import { join } from "node:path";
import { toMeasureId, toUcum, type Anchor, type Terminology } from "@astrohealth/core";

/** Reads data/anchors/<sourceId>.json files built by scripts/build-anchors.ts. */
export function loadAnchors(anchorsDir: string, sourceIds: string[]): Anchor[] {
  return sourceIds.flatMap((id) => {
    const body = JSON.parse(readFileSync(join(anchorsDir, `${id}.json`), "utf8")) as {
      anchors: Anchor[];
    };
    return body.anchors;
  });
}

/**
 * Converts anchor units to UCUM codes and measure names to registry IDs (docs/technical/10 rule 3).
 * Throws when a source unit is not on the allowlist, so no raw unit text reaches the UI.
 */
export function normalizeAnchors(anchors: Anchor[], terminology: Terminology): Anchor[] {
  return anchors.map((a) => {
    const unit = toUcum(terminology, a.unit);
    if (unit === undefined)
      throw new Error(
        `anchor ${a.astronautId} ${a.measure}: unit "${a.unit}" is not on the UCUM allowlist`,
      );
    return { ...a, measure: toMeasureId(terminology, a.measure), unit };
  });
}
