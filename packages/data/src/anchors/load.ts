import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Anchor } from "@astrohealth/core";

/** Reads data/anchors/<sourceId>.json files built by scripts/build-anchors.ts. */
export function loadAnchors(anchorsDir: string, sourceIds: string[]): Anchor[] {
  return sourceIds.flatMap((id) => {
    const body = JSON.parse(readFileSync(join(anchorsDir, `${id}.json`), "utf8")) as {
      anchors: Anchor[];
    };
    return body.anchors;
  });
}
