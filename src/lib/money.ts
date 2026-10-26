// Money is whole centavos everywhere (data-model §1.3). These are the only conversions.

const pesoNumber = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 });

// ₱2,450.00 — the symbol is added by hand so every phone shows the same thing,
// whatever currency data its system has.
export function formatPeso(centavos: number): string {
  const sign = centavos < 0 ? '-' : '';
  const abs = Math.abs(centavos);
  const cents = String(abs % 100).padStart(2, '0');
  return `${sign}₱${pesoNumber.format(Math.floor(abs / 100))}.${cents}`;
}

/** Parses what the user typed ("2,450.5", "₱300") into centavos. Null if it isn't a valid amount. */
export function parsePeso(text: string): number | null {
  const match = /^(\d+)(?:\.(\d{0,2}))?$/.exec(text.replace(/[₱,\s]/g, ''));
  if (!match) return null;
  const centavos = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return Number.isSafeInteger(centavos) ? centavos : null;
}

/** Centavos → editable text without grouping, e.g. 245050 → "2450.50". */
export function centavosToInput(centavos: number): string {
  return `${Math.floor(centavos / 100)}.${String(centavos % 100).padStart(2, '0')}`;
}
