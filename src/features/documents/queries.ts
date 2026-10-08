import 'server-only';
import type { DocumentKind } from '@/generated/prisma/client';
import { can, type Ctx } from '@/server/authz';
import { scopeOf, withTenant } from '@/server/db/tenant';
import { visibleCasesWhere } from '@/features/cases/queries';

export const documentKinds = ['order', 'pleading', 'other'] as const satisfies readonly DocumentKind[];

export type DocumentItem = {
  id: string;
  caseId: string;
  kind: DocumentKind;
  title: string;
  contentType: string;
  confidential: boolean;
  createdAt: Date;
  uploadedByName: string | null;
  mine: boolean;
  canRemove: boolean;
  case?: { type: string; number: string; year: string };
};

/**
 * Documents the person may see (P5, P6). The database enforces the same rules per row;
 * the case filter here keeps associates to the cases they can open.
 */
export async function listDocuments(
  ctx: Ctx,
  opts: { caseId?: string; kind?: DocumentKind; take?: number } = {},
): Promise<DocumentItem[]> {
  if (ctx.role === 'staff') return [];
  return withTenant(scopeOf(ctx), async (tx) => {
    const rows = await tx.document.findMany({
      where: {
        chamberId: ctx.chamberId,
        status: 'ready',
        deletedAt: null,
        ...(opts.caseId ? { caseId: opts.caseId } : {}),
        ...(opts.kind ? { kind: opts.kind } : {}),
        caseInChamber: visibleCasesWhere(ctx),
      },
      orderBy: { createdAt: 'desc' },
      take: opts.take ?? 200,
      select: {
        id: true,
        caseId: true,
        kind: true,
        title: true,
        contentType: true,
        confidential: true,
        createdAt: true,
        uploadedBy: true,
        caseInChamber: opts.caseId ? false : { select: { type: true, number: true, year: true } },
      },
    });
    const uploaders = await tx.membership.findMany({
      where: { chamberId: ctx.chamberId, userId: { in: [...new Set(rows.map((r) => r.uploadedBy))] } },
      select: { userId: true, user: { select: { name: true } } },
    });
    const nameOf = new Map(uploaders.map((u) => [u.userId, u.user.name]));
    return rows.map((r) => ({
      id: r.id,
      caseId: r.caseId,
      kind: r.kind,
      title: r.title,
      contentType: r.contentType,
      confidential: r.confidential,
      createdAt: r.createdAt,
      uploadedByName: nameOf.get(r.uploadedBy) ?? null,
      mine: r.uploadedBy === ctx.userId,
      canRemove: can.removeDocument(ctx, { uploadedBy: r.uploadedBy }),
      ...(r.caseInChamber ? { case: r.caseInChamber } : {}),
    }));
  });
}

/** One ready document the person may open, for the download route. */
export async function documentForDownload(ctx: Ctx, id: string) {
  if (ctx.role === 'staff') return null;
  return withTenant(scopeOf(ctx), (tx) =>
    tx.document.findFirst({
      where: {
        id,
        chamberId: ctx.chamberId,
        status: 'ready',
        deletedAt: null,
        caseInChamber: visibleCasesWhere(ctx),
      },
      select: { storageKey: true, fileName: true, contentType: true },
    }),
  );
}
