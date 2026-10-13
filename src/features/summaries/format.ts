import type { DocumentSummary } from '@/server/providers/ai';
import { stripCitations } from '@/features/drafting/redact';

/**
 * The stored text: outcome, then one point per line, then the next date if any. Citations the model added
 * despite the instructions are removed, as in drafts (no verified library yet).
 */
export function formatSummary(s: DocumentSummary): string {
  const lines = [s.outcome.trim(), ...s.points.slice(0, 8).map((p) => `• ${p.trim()}`)];
  if (s.nextDate && /^\d{4}-\d{2}-\d{2}$/.test(s.nextDate)) lines.push(`→ ${s.nextDate}`);
  return stripCitations(lines.filter(Boolean).join('\n'))
    .text.split('\n')
    .filter((l) => l.trim() && l.trim() !== '•')
    .join('\n')
    .slice(0, 4000);
}
