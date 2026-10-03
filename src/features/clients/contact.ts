import 'server-only';
import { audit } from '@/server/audit';
import { can, ForbiddenError, type Ctx } from '@/server/authz';
import { decryptField, encryptField } from '@/server/crypto';
import { scopeOf, withTenant } from '@/server/db/tenant';

/**
 * The only module that reads or writes client contact (CLAUDE.md rule 1, TECH_GUIDE section 6).
 * Owner-only; every read is written to the audit log. Never import this from code that serves other roles.
 */
export type ClientContact = { phone: string | null; email: string | null; nid: string | null; address: string | null };

const dec = (v: string | null) => (v ? decryptField(v) : null);
const enc = (v: string | null | undefined) => (v ? encryptField(v) : null);

export async function readClientContact(ctx: Ctx, clientId: string): Promise<ClientContact | null> {
  if (!can.viewClientContact(ctx)) throw new ForbiddenError('viewClientContact');
  return withTenant(scopeOf(ctx), async (tx) => {
    const row = await tx.clientContact.findUnique({ where: { clientId } });
    await audit(tx, {
      chamberId: ctx.chamberId,
      actorUserId: ctx.userId,
      action: 'client_contact.view',
      entity: 'client',
      entityId: clientId,
    });
    if (!row) return null;
    return { phone: dec(row.phoneEnc), email: dec(row.emailEnc), nid: dec(row.nidEnc), address: dec(row.addressEnc) };
  });
}

export async function writeClientContact(ctx: Ctx, clientId: string, contact: ClientContact & { consent: boolean }) {
  if (!can.editClientContact(ctx)) throw new ForbiddenError('editClientContact');
  await withTenant(scopeOf(ctx), async (tx) => {
    const data = {
      phoneEnc: enc(contact.phone),
      emailEnc: enc(contact.email),
      nidEnc: enc(contact.nid),
      addressEnc: enc(contact.address),
    };
    const existing = await tx.clientContact.findUnique({ where: { clientId }, select: { consentAt: true } });
    const consentAt = existing?.consentAt ?? (contact.consent ? new Date() : null);
    await tx.clientContact.upsert({
      where: { clientId },
      create: { clientId, chamberId: ctx.chamberId, ...data, consentAt },
      update: { ...data, consentAt },
    });
    await audit(tx, {
      chamberId: ctx.chamberId,
      actorUserId: ctx.userId,
      action: 'client_contact.update',
      entity: 'client',
      entityId: clientId,
      // Which fields are filled, never their values.
      fields: { phone: !!contact.phone, email: !!contact.email, nid: !!contact.nid, address: !!contact.address },
    });
  });
}
