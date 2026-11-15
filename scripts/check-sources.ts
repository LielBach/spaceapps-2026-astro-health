// Fails when sources.json is invalid, or when any file references a sourceId that sources.json lacks.
// CLAUDE.md rule: every threshold or number shown in the UI must carry a source link.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { z } from "zod";

const root = process.cwd();

const Source = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/, "use lowercase kebab-case"),
    title: z.string().min(1),
    url: z.string().url().nullable(),
    verify: z.boolean(),
    note: z.string().optional(),
  })
  .refine((s) => s.url !== null || s.verify, {
    message: "a source with no url must have verify: true",
  });

const Registry = z.object({ sources: z.array(Source) });

const registry = Registry.parse(JSON.parse(readFileSync(join(root, "sources.json"), "utf8")));
const ids = new Set<string>();
const errors: string[] = [];
for (const s of registry.sources) {
  if (ids.has(s.id)) errors.push(`sources.json: duplicate id "${s.id}"`);
  ids.add(s.id);
}

const scanRoots = ["apps", "packages", "catalog", "scenarios", "data/anchors"];
const extensions = /\.(ts|tsx|json|ya?ml)$/;
const skipDirs = new Set(["node_modules", "dist", "coverage"]);
const reference = /sourceIds?["']?\s*[:=]\s*\{?\s*(\[[^\]]*\]|["'][^"']+["'])/g;
const quoted = /["']([^"']+)["']/g;

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (skipDirs.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (extensions.test(name)) yield path;
  }
}

let referenceCount = 0;
for (const scanRoot of scanRoots) {
  const dir = join(root, scanRoot);
  try {
    statSync(dir);
  } catch {
    continue;
  }
  for (const file of walk(dir)) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(reference)) {
      for (const id of (match[1] ?? "").matchAll(quoted)) {
        referenceCount++;
        const sourceId = id[1] ?? "";
        if (!ids.has(sourceId)) {
          errors.push(`${relative(root, file)}: unknown sourceId "${sourceId}"`);
        }
      }
    }
  }
}

const unverified = registry.sources.filter((s) => s.verify).map((s) => s.id);
console.log(
  `sources.json: ${ids.size} sources, ${referenceCount} references checked, ${unverified.length} marked verify (${unverified.join(", ")})`,
);
if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
