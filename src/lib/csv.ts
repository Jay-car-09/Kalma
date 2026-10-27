// CSV that opens cleanly in Excel / Google Sheets / Numbers (RFC 4180).

/** A value Kalma generated itself (e.g. an amount) — written as-is, never formula-guarded. */
export type RawCell = { raw: string };
export type Cell = string | null | RawCell;

const BOM = '﻿'; // lets Excel read UTF-8, so ₱ and ñ show correctly

/**
 * One cell. Text that starts with = + - or @ gets a leading apostrophe so a spreadsheet shows it
 * instead of running it as a formula (CSV injection). Commas, quotes and line breaks are quoted.
 */
export function csvCell(value: Cell): string {
  if (value === null) return '';
  let text = typeof value === 'string' ? value : value.raw;
  if (typeof value === 'string' && /^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: Cell[][]): string {
  return BOM + [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

/** Centavos → plain pesos with 2 decimals for spreadsheets: 245050 → "2450.50", −50000 → "-500.00". */
export function pesoCell(centavos: number | null): Cell {
  if (centavos === null) return null;
  const abs = Math.abs(centavos);
  return { raw: `${centavos < 0 ? '-' : ''}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}` };
}
