import { AccessError } from '@/lib/access-error';
import type { Entry } from '@/lib/openpath';

export function isCoeEntryName(name: string): boolean {
  return /\bCOE\b/i.test(name);
}

export function uniqueEntries(entries: Entry[]): Entry[] {
  const unique = new Map<number, Entry>();
  for (const entry of entries) {
    const previous = unique.get(entry.id);
    if (previous && (previous.name !== entry.name || previous.site !== entry.site || previous.zone !== entry.zone)) {
      throw new AccessError('invalid-response');
    }
    if (!previous) unique.set(entry.id, entry);
  }
  return [...unique.values()];
}
