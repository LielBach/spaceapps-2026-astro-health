// Fails when the terminology registries (catalog/units.yaml, measures.yaml, findings.yaml) are
// incomplete or inconsistent with the catalog, the scenarios or the anchor files (docs/technical/10).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SYSTEM_SOURCES } from "@astrohealth/core";
import {
  loadAnchors,
  loadCatalog,
  loadScenario,
  normalizeAnchors,
  scenarioProblems,
} from "@astrohealth/data";

const root = process.cwd();
const errors: string[] = [];

// loadCatalog runs the catalog and terminology checks and throws on any problem.
let catalog;
try {
  catalog = loadCatalog(join(root, "catalog"));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

for (const file of readdirSync(join(root, "scenarios")).filter((f) => f.endsWith(".yaml"))) {
  const scenario = loadScenario(join(root, "scenarios", file));
  errors.push(...scenarioProblems(scenario, catalog).map((p) => `${file}: ${p}`));
}

// Every unit in every anchor file must convert to a UCUM code on the allowlist.
const anchorIds = readdirSync(join(root, "data/anchors"))
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(/\.json$/, ""));
try {
  normalizeAnchors(loadAnchors(join(root, "data/anchors"), anchorIds), catalog);
} catch (error) {
  errors.push(error instanceof Error ? error.message : String(error));
}

// Every standard code system needs its source in sources.json.
const sources = new Set(
  (
    JSON.parse(readFileSync(join(root, "sources.json"), "utf8")) as { sources: { id: string }[] }
  ).sources.map((s) => s.id),
);
for (const [system, id] of Object.entries(SYSTEM_SOURCES))
  if (!sources.has(id)) errors.push(`sources.json: no source "${id}" for ${system}`);

const mappings = [
  ...catalog.measures.flatMap((m) => m.mappings),
  ...catalog.findings.flatMap((f) => f.mappings),
  ...catalog.conditions.flatMap((c) => c.codes),
];
const unmatched = mappings.filter((m) => m.equivalence === "unmatched").length;
console.log(
  `terminology: ${catalog.units.length} units, ${catalog.measures.length} measures, ${catalog.findings.length} findings, ` +
    `${catalog.conditions.length} conditions; ${mappings.length - unmatched} coded mappings, ${unmatched} unmatched`,
);
if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
