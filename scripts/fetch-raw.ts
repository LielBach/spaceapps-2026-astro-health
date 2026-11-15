// Downloads the real open NASA files that the demos use into data/raw.
// They are checked in, so the app runs offline; run this only to refresh them.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const NLSP = "https://nlsp.nasa.gov/api/v1/files";
const OSDR = "https://osdr.nasa.gov/geode-py/ws/studies";

export const RAW_FILES = [
  {
    file: "nlsp-178066-table2-resting.xlsx",
    sourceId: "nlsp-178066",
    url: `${NLSP}/65b45351-268a-5348-9b4f-1ae9fa38850c/download`,
  },
  {
    file: "nlsp-178066-table3-slopes.xlsx",
    sourceId: "nlsp-178066",
    url: `${NLSP}/010531e9-7b70-55a9-8b64-0316b348a2f7/download`,
  },
  {
    file: "nlsp-dso-402-stand-test.xls",
    sourceId: "nlsp-dso-402",
    url: `${NLSP}/1f402b57-5541-5647-a55b-2e16675a49af/download`,
  },
  {
    file: "osdr-osd-575-cmp.csv",
    sourceId: "osdr-osd-575",
    url: `${OSDR}/OSD-575/download?source=datamanager&file=LSDS-8_Comprehensive_Metabolic_Panel_CMP.upload_SUBMITTED.csv`,
  },
  {
    file: "osdr-osd-569-cbc.csv",
    sourceId: "osdr-osd-569",
    url: `${OSDR}/OSD-569/download?source=datamanager&file=LSDS-7_Complete_Blood_Count_CBC.upload_SUBMITTED.csv`,
  },
] as const;

const dir = join(process.cwd(), "data/raw");
mkdirSync(dir, { recursive: true });
for (const { file, url } of RAW_FILES) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  writeFileSync(join(dir, file), bytes);
  console.log(`${file}: ${bytes.length} bytes`);
}
