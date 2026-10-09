import { parseCsv } from './csv';
import { MAX_CELL, MAX_COLUMNS, MAX_ROWS } from './fields';

export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export type Sheet = { headers: string[]; rows: string[][] };
export type ReadError = 'type' | 'size' | 'empty' | 'rows' | 'columns' | 'unreadable';

/**
 * Reads the first sheet of an .xlsx file, or a .csv file, in the browser. The file itself never leaves
 * the phone or computer; only the cell text of mapped columns is sent when previewing and importing.
 * Date cells become YYYY-MM-DD.
 */
export async function readSheet(file: File): Promise<{ ok: true; sheet: Sheet } | { ok: false; error: ReadError }> {
  if (file.size > MAX_FILE_BYTES) return { ok: false, error: 'size' };
  const name = file.name.toLowerCase();
  let table: string[][];
  try {
    if (name.endsWith('.csv')) {
      table = parseCsv(await file.text());
    } else if (name.endsWith('.xlsx')) {
      table = await readXlsx(await file.arrayBuffer());
    } else {
      return { ok: false, error: 'type' };
    }
  } catch {
    return { ok: false, error: 'unreadable' };
  }
  if (table.length < 2) return { ok: false, error: 'empty' };
  const width = Math.max(...table.map((r) => r.length));
  if (width > MAX_COLUMNS) return { ok: false, error: 'columns' };
  const rows = table
    .slice(1)
    .map((r) => Array.from({ length: width }, (_, i) => (r[i] ?? '').trim().slice(0, MAX_CELL)));
  if (rows.length > MAX_ROWS) return { ok: false, error: 'rows' };
  const headers = Array.from({ length: width }, (_, i) => (table[0][i] ?? '').trim());
  return { ok: true, sheet: { headers, rows } };
}

async function readXlsx(data: ArrayBuffer): Promise<string[][]> {
  // Loaded only on this screen; it is large.
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  const table: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      values[col - 1] = cellText(cell.value);
    });
    table.push(Array.from(values, (v) => v ?? ''));
  });
  return table.filter((r) => r.some((c) => c.trim() !== ''));
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  // Spreadsheet dates carry no time zone; ExcelJS gives them as UTC midnight.
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    const v = value as { richText?: { text: string }[]; text?: unknown; result?: unknown; error?: unknown };
    if (Array.isArray(v.richText)) return v.richText.map((part) => part.text).join('');
    if ('result' in v) return cellText(v.result);
    if (typeof v.text === 'string') return v.text;
    return '';
  }
  return String(value);
}
