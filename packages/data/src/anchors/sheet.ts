import * as XLSX from "xlsx";

export type Row = (string | number)[];

/** Reads the first sheet of an xls or xlsx file as rows of cells. */
export function readRows(bytes: Uint8Array): Row[] {
  const workbook = XLSX.read(bytes);
  const name = workbook.SheetNames[0];
  if (!name) throw new Error("workbook has no sheets");
  const sheet = workbook.Sheets[name];
  if (!sheet) throw new Error(`missing sheet ${name}`);
  return XLSX.utils.sheet_to_json<Row>(sheet, { header: 1, defval: "" });
}

export function num(cell: string | number | undefined): number {
  const value = typeof cell === "number" ? cell : Number(String(cell ?? "").trim());
  if (!Number.isFinite(value)) throw new Error(`not a number: ${String(cell)}`);
  return value;
}

/** "112/87" → [112, 87] */
export function bp(cell: string | number | undefined): [number, number] {
  const [s, d] = String(cell ?? "").split("/");
  return [num(s), num(d)];
}
