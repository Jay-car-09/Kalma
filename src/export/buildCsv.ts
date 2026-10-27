import type { TFunction } from 'i18next';

import type { ExportPayment } from '@/data/export';
import type { Tracker } from '@/data/trackers';
import { pesoCell, toCsv, type Cell } from '@/lib/csv';
import { fromLocalDate } from '@/lib/dates';
import { describeRecurrence } from '@/lib/recurrenceText';

// The two export files (Account tab). Pure: data + current language in, CSV text out.
// Headers and labels follow the app's language; amounts are plain pesos; dates YYYY-MM-DD.

export function trackersCsv(trackers: Tracker[], t: TFunction, language: string): string {
  const header = [
    t('export.col.name'),
    t('export.col.direction'),
    t('export.col.type'),
    t('export.col.amount'),
    t('export.col.dueDate'),
    t('export.col.recurrence'),
    t('export.col.urgency'),
    t('export.col.notify'),
    t('export.col.status'),
    t('export.col.remainingBalance'),
    t('export.col.interestRate'),
    t('export.col.interestPeriod'),
    t('export.col.cutoffDay'),
    t('export.col.notes'),
    t('export.col.created'),
  ];
  const rows: Cell[][] = trackers.map((tr) => [
    tr.name,
    t(`tracker.direction.${tr.direction}`),
    t(`tracker.type.${tr.debtType}`),
    pesoCell(tr.amountCentavos),
    tr.dueDate,
    describeRecurrence(tr.recurrence, tr.dueDate, t, language),
    t(`tracker.urgency.${tr.urgency}`),
    tr.notify ? t('common.yes') : t('common.no'),
    t(`tracker.status.${tr.status}`),
    pesoCell(tr.remainingCentavos),
    tr.interestRate === null ? null : { raw: String(tr.interestRate) },
    tr.interestRate === null || tr.interestPeriod === null ? null : t(`form.period.${tr.interestPeriod}`),
    tr.statementCutoffDay === null ? null : { raw: String(tr.statementCutoffDay) },
    tr.notes,
    fromLocalDate(new Date(tr.createdAt)), // the user's calendar day, not UTC
  ]);
  return toCsv(header, rows);
}

export function paymentsCsv(payments: ExportPayment[], t: TFunction): string {
  const header = [
    t('export.col.tracker'),
    t('export.col.kind'),
    t('export.col.amount'),
    t('export.col.paidOn'),
    t('export.col.dueSettled'),
    t('export.col.note'),
  ];
  const rows: Cell[][] = payments.map((p) => [
    p.trackerName,
    t(`export.kind.${p.kind}`),
    pesoCell(p.amountCentavos), // adjustments keep their sign: positive = balance went up
    p.paidOn,
    p.occurrenceDueDate,
    p.note,
  ]);
  return toCsv(header, rows);
}
