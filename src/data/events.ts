// Every write in src/data/ calls notifyChange(), so open screens refresh (e.g. after Undo).
const listeners = new Set<() => void>();

export function notifyChange() {
  listeners.forEach((listener) => listener());
}

export function onChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
