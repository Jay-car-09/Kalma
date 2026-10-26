// Free vs Paid limits (CLAUDE.md §5, data-model §6). The only place these numbers live,
// so Phase 3 can swap isPaid for the real subscription without touching screens.
export function getLimits(isPaid: boolean) {
  return isPaid ? { trackers: Infinity, notified: Infinity } : { trackers: 10, notified: 5 };
}

export type LimitKind = 'trackers' | 'notified';

/** Thrown by the data layer when a write would go over a Free limit. Screens show a calm prompt. */
export class LimitError extends Error {
  readonly kind: LimitKind;

  constructor(kind: LimitKind) {
    super(`Free limit reached: ${kind}`);
    this.name = 'LimitError';
    this.kind = kind;
  }
}
