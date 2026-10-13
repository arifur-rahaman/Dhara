import 'server-only';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod/v4';
import { env } from '@/server/env';
import { anthropic, FALLBACK_MODELS } from './ai';

/**
 * Drafting (F33) on the AiProvider. Inputs reach here already redacted: names, phone numbers, emails and
 * NID numbers are placeholders like [PERSON_1]. Model from AI_MODEL_DRAFT, never from code.
 */

export const factCheck = z.object({
  items: z.array(z.object({ key: z.string(), found: z.boolean(), question: z.string() })),
});
export type FactCheck = z.infer<typeof factCheck>;

export type DraftRequest = {
  kind: string;
  language: 'en' | 'bn';
  facts: string;
  checklist: string[];
  outline: string[];
};

export interface DraftProvider {
  /** Which checklist items the facts already cover, with one question for each missing item. */
  checkFacts(input: DraftRequest): Promise<FactCheck | null>;
  /** The draft as it is written. Ends with the full text; throws on failure. */
  streamDraft(input: DraftRequest): AsyncGenerator<string, { text: string; refused: boolean }>;
}

const lang = (l: 'en' | 'bn') => (l === 'bn' ? 'Bangla (formal court Bangla as used in Bangladesh)' : 'English');

const CHECK_SYSTEM = `You help a lawyer in Bangladesh prepare a court draft. You get the lawyer's facts and a checklist of what the draft needs.
For each checklist key, say whether the facts already give it (found) and, if not, write one short question the lawyer can answer.
Write questions in the requested language. Names appear as placeholders like [PERSON_1]; keep them as they are.`;

const DRAFT_SYSTEM = `You prepare a first DRAFT of a court document for a lawyer in Bangladesh. The lawyer will check and correct every line; the lawyer decides.
Rules:
- Use only the facts the lawyer gave. Where something is missing, write a blank like [ ... ] for the lawyer to fill. Never invent facts, dates, amounts, names or numbers.
- Keep placeholders such as [PERSON_1], [PHONE_1] exactly as written.
- Do not cite any case law, judgment or law report (DLR, BLD, BLC and the like): there is no verified library to check them against.
- Name a statute or section only if the lawyer's facts name it; otherwise write [section to be checked by the lawyer].
- Follow the given outline: each heading on its own line, then its text. Plain text, no Markdown symbols.
- The first line is DRAFT on its own.`;

function prompt(input: DraftRequest) {
  return [
    `Kind: ${input.kind}`,
    `Language: ${lang(input.language)}`,
    `Outline:\n${input.outline.map((h, i) => `${i + 1}. ${h}`).join('\n')}`,
    `Checklist keys: ${input.checklist.join(', ')}`,
    `Lawyer's facts:\n"""\n${input.facts}\n"""`,
  ].join('\n\n');
}

function model() {
  const m = env().AI_MODEL_DRAFT;
  if (!m) throw new Error('AI_MODEL_DRAFT is not set. See .env.example.');
  return m;
}

const fallbacks = (m: string) =>
  FALLBACK_MODELS.has(m) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {};

const anthropicDrafts: DraftProvider = {
  async checkFacts(input) {
    const m = model();
    try {
      const response = await anthropic().beta.messages.parse({
        model: m,
        max_tokens: 4000,
        output_config: { effort: 'low', format: zodOutputFormat(factCheck) },
        ...fallbacks(m),
        system: CHECK_SYSTEM,
        messages: [{ role: 'user', content: prompt(input) }],
      });
      if (response.stop_reason === 'refusal') return null;
      return response.parsed_output ?? null;
    } catch {
      console.error('[ai] fact check failed');
      return null;
    }
  },
  async *streamDraft(input) {
    const m = model();
    const stream = anthropic().beta.messages.stream({
      model: m,
      max_tokens: 32000,
      output_config: { effort: 'medium' },
      ...fallbacks(m),
      system: DRAFT_SYSTEM,
      messages: [{ role: 'user', content: prompt(input) }],
    });
    let text = '';
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        text += event.delta.text;
        yield event.delta.text;
      }
    }
    const final = await stream.finalMessage();
    return { text, refused: final.stop_reason === 'refusal' };
  },
};

/** Development and tests only: fixed answers. In production it does nothing (see aiProvider). */
const fakeDrafts: DraftProvider = {
  async checkFacts(input) {
    if (process.env.NODE_ENV === 'production') return null;
    return {
      items: input.checklist.map((key, i) => ({
        key,
        found: i % 2 === 0,
        question: input.language === 'bn' ? `${key} সম্পর্কে লিখুন` : `Tell us about ${key}`,
      })),
    };
  },
  async *streamDraft(input) {
    if (process.env.NODE_ENV === 'production') throw new Error('fake AI provider in production');
    const body = [
      'DRAFT',
      ...input.outline.flatMap((h) => [h, '[ ... ]']),
      // Echo a placeholder so tests can see names put back, and a citation so tests can see it removed.
      input.facts.match(/\[PERSON_\d+\]/)?.[0] ?? '',
      'See 45 DLR (AD) 123 for this point.',
    ].join('\n');
    for (const piece of body.match(/[\s\S]{1,40}/g) ?? []) yield piece;
    return { text: body, refused: false };
  },
};

export function draftProvider(): DraftProvider {
  return env().AI_PROVIDER === 'anthropic' ? anthropicDrafts : fakeDrafts;
}
