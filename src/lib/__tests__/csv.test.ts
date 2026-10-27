import { describe, expect, it } from '@jest/globals';

import { csvCell, pesoCell, toCsv } from '../csv';

describe('csvCell escaping', () => {
  it('leaves plain text alone', () => {
    expect(csvCell('BPI Card')).toBe('BPI Card');
    expect(csvCell(null)).toBe('');
  });

  it('quotes commas, quotes and line breaks', () => {
    expect(csvCell('Juan, Jr.')).toBe('"Juan, Jr."');
    expect(csvCell('Ate "Joy"')).toBe('"Ate ""Joy"""');
    expect(csvCell('line 1\nline 2')).toBe('"line 1\nline 2"');
    expect(csvCell('a\r\nb')).toBe('"a\r\nb"');
  });

  it('keeps ₱ and ñ untouched', () => {
    expect(csvCell('Señora ₱500')).toBe('Señora ₱500');
  });
});

describe('formula-injection guard', () => {
  it('prefixes cells starting with = + - @ with an apostrophe', () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvCell('+63 917 000 0000')).toBe("'+63 917 000 0000");
    expect(csvCell('-cmd')).toBe("'-cmd");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  it('only guards the first character', () => {
    expect(csvCell('Pay 1+1')).toBe('Pay 1+1');
    expect(csvCell('a=b')).toBe('a=b');
  });

  it('never guards values Kalma generates (negative amounts stay numbers)', () => {
    expect(csvCell(pesoCell(-50000))).toBe('-500.00');
  });
});

describe('pesos in CSV', () => {
  it('plain pesos with 2 decimals, no ₱ or thousands separators', () => {
    expect(csvCell(pesoCell(245050))).toBe('2450.50');
    expect(csvCell(pesoCell(123456789))).toBe('1234567.89');
    expect(csvCell(pesoCell(5))).toBe('0.05');
    expect(csvCell(pesoCell(0))).toBe('0.00');
    expect(csvCell(pesoCell(null))).toBe('');
  });
});

describe('toCsv', () => {
  it('starts with a UTF-8 BOM and uses CRLF line endings', () => {
    expect(toCsv(['Name', 'Amount (PHP)'], [['Juan, Jr.', pesoCell(100)]])).toBe(
      '﻿Name,Amount (PHP)\r\n"Juan, Jr.",1.00\r\n',
    );
  });
});
