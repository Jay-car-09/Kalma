const pesoNumber = new Intl.NumberFormat('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// ₱2,450.00 — the symbol is added by hand so every phone shows the same thing,
// whatever currency data its system has.
export function formatPeso(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}₱${pesoNumber.format(Math.abs(value))}`;
}
