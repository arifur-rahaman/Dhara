'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { z } from 'zod';
import { isYmd, todayInDhaka } from '@/lib/dates';
import { audit } from '@/server/audit';
import { can } from '@/server/authz';
import { requireCtx } from '@/server/context';
import { scopeOf, withTenant } from '@/server/db/tenant';
import { aiProvider } from '@/server/providers/ai';
import { syncMyCalendar } from '@/features/calendar-sync/sync';
import { applyNextDate } from '@/features/cases/next-date';
import { visibleCasesWhere } from '@/features/cases/queries';
import { getPreferences } from '@/features/preferences/server';
import { caseNumberMatches, isIsoDate } from './match';

/** About 700 KB of JPEG: the browser shrinks the photo first; server actions accept about 1 MB. */
const MAX_IMAGE_BYTES = 700_000;

export type ReadPhotoResult =
  | {
      ok: true;
      nextDate: string | null;
      summary: string;
      dateConfidence: 'clear' | 'unsure' | 'none';
      caseMatch: 'yes' | 'no' | 'unknown';
    }
  | { ok: false; error: 'off' | 'notFound' | 'tooBig' | 'badImage' | 'unreadable' | 'unavailable' };

const readInput = z.object({ caseId: z.uuid(), image: z.string().max(1_000_000) });

/**
 * F37: reads the next date and a short summary from a photo of an order. Nothing is saved here; the person
 * checks and edits the result, then saves (saveOrderReading). Only for people who may add a next date to
 * this case (P4), and only after the owner has allowed order photos to be read by AI in Settings.
 */
export async function readOrderPhoto(input: unknown): Promise<ReadPhotoResult> {
  const ctx = await requireCtx();
  const parsed = readInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'badImage' };
  const m = parsed.data.image.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return { ok: false, error: 'badImage' };
  const mediaType = m[1] as 'image/jpeg' | 'image/png' | 'image/webp';
  const image = Buffer.from(m[2], 'base64');
  if (image.length > MAX_IMAGE_BYTES) return { ok: false, error: 'tooBig' };
  if (!looksLike(image, mediaType)) return { ok: false, error: 'badImage' };

  const found = await withTenant(scopeOf(ctx), async (tx) => {
    const chamber = await tx.chamber.findUniqueOrThrow({
      where: { id: ctx.chamberId },
      select: { aiPhotoReading: true },
    });
    const c = await tx.case.findFirst({
      where: { AND: [visibleCasesWhere(ctx), { id: parsed.data.caseId }] },
      select: { number: true, year: true, assigneeMembershipId: true },
    });
    return { on: chamber.aiPhotoReading, c };
  });
  if (!found.on) return { ok: false, error: 'off' };
  if (!found.c || !can.addHearing(ctx, { assigneeMembershipId: found.c.assigneeMembershipId })) {
    return { ok: false, error: 'notFound' };
  }

  const { locale } = await getPreferences();
  const result = await aiProvider().readOrderPhoto({ image, mediaType, language: locale, today: todayInDhaka() });
  if (!result.ok) return { ok: false, error: result.reason };
  const r = result.reading;
  return {
    ok: true,
    nextDate: isIsoDate(r.nextDate) ? r.nextDate : null,
    summary: r.summary.trim().slice(0, 300),
    dateConfidence: r.dateConfidence,
    caseMatch: caseNumberMatches(r.caseNumber, found.c),
  };
}

function looksLike(bytes: Buffer, type: string) {
  if (type === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8;
  if (type === 'image/png') return bytes.subarray(0, 4).toString('hex') === '89504e47';
  return bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
}

const saveInput = z.object({
  caseId: z.uuid(),
  date: z.string().refine(isYmd),
  summary: z.string().trim().max(500),
});

export type SaveReadingResult = { ok: true } | { ok: false; error: 'dateInvalid' | 'notFound' };

/**
 * Saves what the person confirmed: the next date, with the summary as what happened at today's hearing
 * (the same write as the Next date sheet, F18). The photo itself is uploaded as an order document first.
 */
export async function saveOrderReading(input: unknown): Promise<SaveReadingResult> {
  const ctx = await requireCtx();
  // applyNextDate checks P4 against the case itself; office staff never add dates.
  if (ctx.role === 'staff') return { ok: false, error: 'notFound' };
  const parsed = saveInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'dateInvalid' };
  const { caseId, date, summary } = parsed.data;
  const today = todayInDhaka();
  if (date < today) return { ok: false, error: 'dateInvalid' };
  const outcome = await withTenant(scopeOf(ctx), async (tx) => {
    const result = await applyNextDate(tx, ctx, { caseId, date, note: summary || null }, today);
    if (result !== 'notFound') {
      await audit(tx, {
        chamberId: ctx.chamberId,
        actorUserId: ctx.userId,
        action: 'ai.order_photo_saved',
        entity: 'case',
        entityId: caseId,
      });
    }
    return result;
  });
  if (outcome === 'notFound') return { ok: false, error: 'notFound' };
  after(() => syncMyCalendar(ctx, { force: true }));
  revalidatePath(`/cases/${caseId}`);
  return { ok: true };
}
