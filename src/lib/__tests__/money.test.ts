import { describe, expect, it } from '@jest/globals';

import { centavosToInput, formatPeso, parsePeso } from '../money';

describe('money', () => {
  it('formats centavos as pesos', () => {
    expect(formatPeso(245000)).toBe('₱2,450.00');
    expect(formatPeso(245050)).toBe('₱2,450.50');
    expect(formatPeso(5)).toBe('₱0.05');
    expect(formatPeso(-123456789)).toBe('-₱1,234,567.89');
  });

  it('parses typed amounts into centavos', () => {
    expect(parsePeso('2,450.5')).toBe(245050);
    expect(parsePeso('₱300')).toBe(30000);
    expect(parsePeso('0.05')).toBe(5);
    expect(parsePeso('12.')).toBe(1200);
  });

  it('rejects anything that is not an amount', () => {
    for (const bad of ['', 'abc', '1.234', '-5', '1.2.3']) expect(parsePeso(bad)).toBeNull();
  });

  it('round-trips through the edit field', () => {
    expect(parsePeso(centavosToInput(245050))).toBe(245050);
  });
});
