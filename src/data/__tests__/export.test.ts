import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { paymentsCsv, trackersCsv } from '@/export/buildCsv';
import i18n from '@/i18n';

import type { TrackerInput } from '../trackers';

jest.mock('../db'); // src/data/__mocks__/db.ts — real SQL on Node's SQLite
jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));

const { db } = require('../db');
const { migrate } = require('../migrations');
const trackers = require('../trackers') as typeof import('../trackers');
const payments = require('../payments') as typeof import('../payments');
const { listTrackersForExport, listPaymentsForExport } = require('../export') as typeof import('../export');

const input = (overrides: Partial<TrackerInput> = {}): TrackerInput => ({
  direction: 'owe',
  name: 'BPI Card',
  amountCentavos: 245050,
  debtType: 'credit_card',
  dueDate: '2026-11-15',
  recurrence: { type: 'monthly', day: 15 },
  urgency: 'high',
  notify: true,
  startingBalanceCentavos: 1000000,
  interestRate: 3.5,
  interestPeriod: 'monthly',
  statementCutoffDay: 20,
  notes: '=SUM(A1), "card"',
  ...overrides,
});

const lines = (csv: string) => csv.replace(/^﻿/, '').trimEnd().split('\r\n');
const t = i18n.t.bind(i18n);

beforeEach(async () => {
  db.reset();
  await migrate(db);
  await i18n.changeLanguage('en');
});

describe('CSV export', () => {
  it('trackers file: headers, readable values, guarded notes; deleted trackers left out', async () => {
    const card = await trackers.createTracker(input(), true);
    const gone = await trackers.createTracker(input({ name: 'Deleted loan' }), true);
    await trackers.setArchived(await trackers.createTracker(input({ name: 'Old loan', notes: null }), true), true);
    await trackers.deleteTracker(gone);
    await payments.markPaid(card, { amountCentavos: 245050, paidOn: '2026-11-14', note: null });

    const [header, ...rows] = lines(trackersCsv(await listTrackersForExport(), t, 'en'));
    expect(header).toBe(
      'Name,Direction,Type,Amount (PHP),Due date,Repeats,Urgency,Reminders,Status,Remaining balance (PHP),' +
        'Interest rate (%),Interest period,Statement cutoff day,Notes,Created',
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatch(
      /^BPI Card,I owe,Credit card,2450\.50,2026-12-15,Monthly on the 15th,High,Yes,Active,7549\.50,3\.5,Per month,20,"'=SUM\(A1\), ""card""",\d{4}-\d{2}-\d{2}$/,
    );
    expect(rows[1]).toContain('Old loan');
    expect(rows[1]).toContain(',Archived,');
    expect(rows.join()).not.toContain('Deleted loan');
  });

  it('payments file: kinds, signed amounts, settled due date; deleted payments left out', async () => {
    const card = await trackers.createTracker(input(), true);
    const kept = await payments.markPaid(card, { amountCentavos: 245050, paidOn: '2026-11-14', note: 'GCash' });
    await payments.deletePayment(await payments.markPaid(card, { amountCentavos: 100, paidOn: '2026-11-20', note: null }));
    // ₱10,000 − ₱2,450.50 paid = ₱7,549.50 left; setting it to ₱7,000 saves −₱549.50
    await payments.updateRemainingBalance(card, 700000);

    const [header, ...rows] = lines(paymentsCsv(await listPaymentsForExport(), t));
    expect(header).toBe('Tracker,Kind,Amount (PHP),Paid on,Due date settled,Note');
    expect(rows).toHaveLength(2);
    expect(rows).toContain('BPI Card,Payment,2450.50,2026-11-14,2026-11-15,GCash');
    expect(rows.find((r) => r.includes('Balance adjustment'))).toMatch(
      /^BPI Card,Balance adjustment,-549\.50,\d{4}-\d{2}-\d{2},,$/,
    );
    expect(kept).toBeTruthy();
  });

  it('headers follow the app language', async () => {
    await i18n.changeLanguage('tl');
    expect(lines(paymentsCsv([], t))[0]).toBe('Tracker,Uri,Halaga (PHP),Petsa ng bayad,Due date na binayaran,Note');
    await i18n.changeLanguage('en');
  });
});
