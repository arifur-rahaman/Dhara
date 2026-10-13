import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod/v4';
import { env } from '@/server/env';

/**
 * AiProvider (plan.md 7.3, 7.5). Model names come from the environment, never from code.
 * Every call returns structured data the app checks; nothing the model says is saved without a person
 * confirming it on screen.
 */

/** What the app needs from a photo of a court order (F37). */
export const orderReading = z.object({
  /** The next hearing date written in the order, as YYYY-MM-DD; null when there is none or it is unclear. */
  nextDate: z.string().nullable(),
  /** What the order says happened, in one short sentence, without names, phone numbers or addresses. */
  summary: z.string(),
  /** The case number as written on the order (for example "245/2026"), or null. */
  caseNumber: z.string().nullable(),
  /** The model's own view of how clearly it could read the date. */
  dateConfidence: z.enum(['clear', 'unsure', 'none']),
});
export type OrderReading = z.infer<typeof orderReading>;

export type ReadOrderResult = { ok: true; reading: OrderReading } | { ok: false; reason: 'unreadable' | 'unavailable' };

export interface AiProvider {
  readOrderPhoto(input: {
    image: Buffer;
    mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
    language: 'en' | 'bn';
    today: string;
  }): Promise<ReadOrderResult>;
}

const ORDER_SYSTEM = `You read photos of court orders from Bangladesh (Bangla or English, printed or handwritten) for a lawyer's case diary.
Return only what is written on the order:
- nextDate: the next hearing date the order fixes ("পরবর্তী তারিখ", "পরের তারিখ", "next date", "fixed for"), as YYYY-MM-DD. Dates are written day first (12/10/2026, ১২.১০.২০২৬). A two-digit year means 20xx. If no next date is written, or you cannot read it with confidence, return null and set dateConfidence accordingly. Never guess a date.
- summary: one short sentence (at most 20 words) saying what the court did today, for example "Plaintiff's time petition allowed" or "Hearing adjourned at defence prayer". Do not include any person's name, phone number, NID number or address.
- caseNumber: the case number as written (for example "245/2026"), or null.
- dateConfidence: "clear" if the date is plainly legible, "unsure" if you read a date but parts are hard to read, "none" if there is no date.
Write the summary in the language given in the request.`;

/** Models that accept the server-side fallback for policy declines (claude-api skill: Opus 5.5 and peers). */
const FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-sonnet-5-5']);

let client: Anthropic | null = null;
function anthropic() {
  const key = env().ANTHROPIC_API_KEY;
  if (!key) throw new Error('AI_PROVIDER=anthropic needs ANTHROPIC_API_KEY');
  client ??= new Anthropic({ apiKey: key, timeout: 60_000, maxRetries: 1 });
  return client;
}

const anthropicProvider: AiProvider = {
  async readOrderPhoto({ image, mediaType, language, today }) {
    const model = env().AI_MODEL_EXTRACT;
    if (!model) throw new Error('AI_MODEL_EXTRACT is not set. See .env.example.');
    try {
      const response = await anthropic().beta.messages.parse({
        model,
        max_tokens: 4000,
        output_config: { effort: 'medium', format: zodOutputFormat(orderReading) },
        ...(FALLBACK_MODELS.has(model)
          ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
          : {}),
        system: ORDER_SYSTEM,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: image.toString('base64') } },
              {
                type: 'text',
                text: `Today is ${today} (Asia/Dhaka). Summary language: ${language === 'bn' ? 'Bangla' : 'English'}.`,
              },
            ],
          },
        ],
      });
      if (response.stop_reason === 'refusal' || !response.parsed_output) return { ok: false, reason: 'unreadable' };
      return { ok: true, reading: response.parsed_output };
    } catch (error) {
      // Never log the image or the order's text; the status is enough to investigate.
      const status = error instanceof Anthropic.APIError ? error.status : 'network';
      console.error(`[ai] order photo failed (${status})`);
      return { ok: false, reason: 'unavailable' };
    }
  },
};

/** Development and tests: a fixed reading, so the screens can be used without a key or network. */
const fakeProvider: AiProvider = {
  async readOrderPhoto({ language, today }) {
    // A fixed date must never reach a real chamber: in production the fake answers "unavailable".
    if (process.env.NODE_ENV === 'production') return { ok: false, reason: 'unavailable' };
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 30);
    return {
      ok: true,
      reading: {
        nextDate: d.toISOString().slice(0, 10),
        summary: language === 'bn' ? 'বাদীর সময়ের আবেদন মঞ্জুর' : "Plaintiff's time petition allowed",
        caseNumber: null,
        dateConfidence: 'clear',
      },
    };
  },
};

export function aiProvider(): AiProvider {
  return env().AI_PROVIDER === 'anthropic' ? anthropicProvider : fakeProvider;
}
