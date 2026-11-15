// Parses data/raw into data/anchors/<sourceId>.json. Values are copied, never changed.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Anchor } from "@orbivit/core";
import {
  lowestPreflightAlbumin,
  parseLabCsv,
  parseRestingTable,
  parseSlopeTable,
  parseStandTest,
} from "@orbivit/data";

const raw = (file: string) => readFileSync(join(process.cwd(), "data/raw", file));
const out = join(process.cwd(), "data/anchors");
mkdirSync(out, { recursive: true });

function write(sourceId: string, files: string[], license: string, anchors: Anchor[]) {
  const body = { sourceId, files, license, anchorCount: anchors.length, anchors };
  writeFileSync(join(out, `${sourceId}.json`), JSON.stringify(body, null, 2) + "\n");
  console.log(`${sourceId}: ${anchors.length} anchors`);
}

const nasa = "NASA open data (U.S. Government work)";
write("nlsp-178066", ["nlsp-178066-table2-resting.xlsx", "nlsp-178066-table3-slopes.xlsx"], nasa, [
  ...parseRestingTable(raw("nlsp-178066-table2-resting.xlsx")),
  ...parseSlopeTable(raw("nlsp-178066-table3-slopes.xlsx")),
]);
write(
  "nlsp-dso-402",
  ["nlsp-dso-402-stand-test.xls"],
  nasa,
  parseStandTest(raw("nlsp-dso-402-stand-test.xls")),
);
const cmp = parseLabCsv(raw("osdr-osd-575-cmp.csv").toString("utf8"), "osdr-osd-575");
write("osdr-osd-575", ["osdr-osd-575-cmp.csv"], nasa, cmp);
write(
  "osdr-osd-569",
  ["osdr-osd-569-cbc.csv"],
  nasa,
  parseLabCsv(raw("osdr-osd-569-cbc.csv").toString("utf8"), "osdr-osd-569"),
);
const maya = lowestPreflightAlbumin(cmp);
console.log(`Lowest mean pre-flight albumin: ${maya.astronautId} (${maya.mean.toFixed(2)} g/dL)`);
