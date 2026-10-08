'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { uuidv7 } from '@/lib/uuid';
import { audit } from '@/server/audit';
import { can } from '@/server/authz';
import { requireCtx } from '@/server/context';
import { scopeOf, withTenant } from '@/server/db/tenant';
import { storage } from '@/server/providers/storage';
import { visibleCasesWhere } from '@/features/cases/queries';
import { MAX_UPLOAD_BYTES, allowedTypes, extensionOf, sniffType } from './files';

const startInput = z.object({
  caseId: z.uuid(),
  kind: z.enum(['order', 'pleading', 'other']),
  title: z.string().trim().min(1).max(200),
  fileName: z.string().trim().min(1).max(255),
  contentType: z.enum(allowedTypes),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  confidential: z.boolean(),
});

export type StartUploadResult = { ok: true; documentId: string; url: string } | { ok: false; error: string };

/**
 * Step 1 of an upload (TECH_GUIDE section 13): check the case and permission, record a pending
 * document and hand back a 5-minute upload URL. The file goes straight to storage.
 */
export async function startUpload(input: z.input<typeof startInput>): Promise<StartUploadResult> {
  const ctx = await requireCtx();
  const parsed = startInput.safeParse(input);
  if (!parsed.success) {
    const tooBig = parsed.error.issues.some((i) => i.path[0] === 'size');
    const badType = parsed.error.issues.some((i) => i.path[0] === 'contentType');
    return { ok: false, error: tooBig ? 'fileTooBig' : badType ? 'fileType' : 'documentInvalid' };
  }
  const v = parsed.data;
  // Only the owner and associates mark documents private (P6); munshi upload orders.
  const confidential = v.confidential && (ctx.role === 'owner' || ctx.role === 'associate');

  const id = uuidv7();
  const key = `chambers/${ctx.chamberId}/cases/${v.caseId}/${id}.${extensionOf[v.contentType]}`;
  const ok = await withTenant(scopeOf(ctx), async (tx) => {
    const kase = await tx.case.findFirst({
      where: { AND: [visibleCasesWhere(ctx), { id: v.caseId }] },
      select: { assigneeMembershipId: true },
    });
    if (!kase || !can.uploadDocument(ctx, kase, v.kind)) return false;
    await tx.document.createMany({
      data: {
        id,
        chamberId: ctx.chamberId,
        caseId: v.caseId,
        kind: v.kind,
        title: v.title,
        fileName: v.fileName,
        contentType: v.contentType,
        sizeBytes: v.size,
        storageKey: key,
        confidential,
        uploadedBy: ctx.userId,
      },
    });
    return true;
  });
  if (!ok) return { ok: false, error: 'documentInvalid' };
  return { ok: true, documentId: id, url: await storage().uploadUrl(key, v.contentType) };
}

/** Step 2: check what actually arrived (size and real file type) before the document becomes visible. */
export async function finishUpload(documentId: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireCtx();
  const id = z.uuid().parse(documentId);
  const doc = await withTenant(scopeOf(ctx), (tx) =>
    tx.document.findFirst({
      where: { id, chamberId: ctx.chamberId, uploadedBy: ctx.userId, status: 'pending', deletedAt: null },
      select: { storageKey: true, contentType: true, caseId: true },
    }),
  );
  if (!doc) return { ok: false, error: 'documentInvalid' };

  const store = storage();
  const size = await store.size(doc.storageKey);
  const real = size ? sniffType(await store.head(doc.storageKey, 16)) : null;
  const valid = !!size && size <= MAX_UPLOAD_BYTES && real === doc.contentType;
  if (!valid) await store.remove(doc.storageKey);

  await withTenant(scopeOf(ctx), (tx) =>
    tx.document.updateMany({
      where: { id, uploadedBy: ctx.userId, status: 'pending' },
      data: valid ? { status: 'ready', sizeBytes: size! } : { deletedAt: new Date() },
    }),
  );
  if (!valid) return { ok: false, error: size && size > MAX_UPLOAD_BYTES ? 'fileTooBig' : 'fileType' };
  revalidatePath(`/cases/${doc.caseId}`);
  revalidatePath('/documents');
  return { ok: true };
}

/** Owner or uploader removes a document (soft delete, audited). */
export async function removeDocument(form: FormData) {
  const ctx = await requireCtx();
  const id = z.uuid().parse(form.get('documentId'));
  const caseId = await withTenant(scopeOf(ctx), async (tx) => {
    const doc = await tx.document.findFirst({
      where: { id, chamberId: ctx.chamberId, deletedAt: null },
      select: { uploadedBy: true, caseId: true, kind: true, confidential: true },
    });
    if (!doc || !can.removeDocument(ctx, doc)) return null;
    await tx.document.updateMany({ where: { id }, data: { deletedAt: new Date() } });
    await audit(tx, {
      chamberId: ctx.chamberId,
      actorUserId: ctx.userId,
      action: 'document.delete',
      entity: 'document',
      entityId: id,
      fields: { caseId: doc.caseId, kind: doc.kind, confidential: doc.confidential },
    });
    return doc.caseId;
  });
  if (caseId) {
    revalidatePath(`/cases/${caseId}`);
    revalidatePath('/documents');
  }
}
