'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { can } from '@/server/authz';
import { requireCtx } from '@/server/context';
import { scopeOf, withTenant } from '@/server/db/tenant';
import { aiProvider } from '@/server/providers/ai';
import { storage } from '@/server/providers/storage';
import { documentForDownload } from '@/features/documents/queries';
import { getPreferences } from '@/features/preferences/server';
import { formatSummary } from './format';

/**
 * F38: summarises a judgment or order the chamber uploaded. Owners and associates (P8), on documents they
 * can open (P5, P6), and only after the owner allowed documents to be read by AI (the same switch as
 * order photos: a document cannot be redacted before it is sent). The summary is kept with the document.
 */
export async function summarizeDocument(form: FormData) {
  const ctx = await requireCtx();
  const id = z.uuid().parse(form.get('documentId'));
  const back = (error?: string) => redirect(`/documents/${id}/summary${error ? `?error=${error}` : ''}`);
  if (!can.useAi(ctx)) back('notAllowed');
  const on = await withTenant(
    scopeOf(ctx),
    async (tx) =>
      (await tx.chamber.findUniqueOrThrow({ where: { id: ctx.chamberId }, select: { aiPhotoReading: true } }))
        .aiPhotoReading,
  );
  if (!on) back('off');
  const doc = await documentForDownload(ctx, id);
  if (!doc) back('notFound');
  const type = doc!.contentType as 'application/pdf' | 'image/jpeg' | 'image/png';
  const data = Buffer.from(await storage().read(doc!.storageKey));
  const { locale } = await getPreferences();
  const result = await aiProvider().summarizeDocument({ data, mediaType: type, language: locale });
  if (!result.ok) back(result.reason);
  const summary = (result as Extract<typeof result, { ok: true }>).summary;
  await withTenant(scopeOf(ctx), (tx) =>
    tx.aiSummary.create({
      data: {
        chamberId: ctx.chamberId,
        documentId: id,
        language: locale,
        summary: formatSummary(summary),
        createdBy: ctx.userId,
      },
      select: { id: true },
    }),
  );
  back();
}
