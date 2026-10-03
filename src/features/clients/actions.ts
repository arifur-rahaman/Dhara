'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { normalizeBdPhone } from '@/lib/phone';
import { assertCan, can } from '@/server/authz';
import { requireCtx } from '@/server/context';
import { scopeOf, withTenant } from '@/server/db/tenant';
import type { FormState } from '@/features/auth/actions';
import { writeClientContact } from './contact';

const contactInput = z.object({
  phone: z.string().trim().optional(),
  email: z.union([z.literal(''), z.email()]).optional(),
  nid: z
    .string()
    .trim()
    .refine(
      (v) => v === '' || /^(\d{10}|\d{13}|\d{17})$/.test(v.replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d)))),
    )
    .optional(),
  address: z.string().trim().max(300).optional(),
  consent: z.string().optional(),
});

function parseContact(values: Record<string, string>) {
  const parsed = contactInput.safeParse(values);
  if (!parsed.success) return { error: 'contactInvalid' as const };
  const c = parsed.data;
  const phone = c.phone ? normalizeBdPhone(c.phone) : null;
  if (c.phone && !phone) return { error: 'phoneInvalid' as const };
  const contact = { phone, email: c.email || null, nid: c.nid || null, address: c.address || null };
  const any = Object.values(contact).some(Boolean);
  // Personal data needs the client's consent first (plan.md section 8).
  if (any && c.consent !== 'yes') return { error: 'clientConsentRequired' as const };
  return { contact, consent: c.consent === 'yes', any };
}

/** New client. Associates add a name only; contact details are owner-only (P1). */
export async function createClient(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  assertCan('createClient', ctx);
  const values = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
  const name = z.string().trim().min(2).max(120).safeParse(values.name);
  if (!name.success) return { error: 'clientNameInvalid', values };

  const contact = can.editClientContact(ctx) ? parseContact(values) : null;
  if (contact && 'error' in contact) return { error: contact.error, values };

  const client = await withTenant(scopeOf(ctx), (tx) =>
    tx.client.create({ data: { chamberId: ctx.chamberId, displayName: name.data, createdBy: ctx.userId } }),
  );
  if (contact?.any) await writeClientContact(ctx, client.id, { ...contact.contact, consent: contact.consent });
  redirect(`/clients/${client.id}`);
}

/** Owner edits a client's contact details. */
export async function saveClientContact(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  assertCan('editClientContact', ctx);
  const values = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
  const clientId = z.uuid().safeParse(values.clientId);
  if (!clientId.success) return { error: 'contactInvalid', values };
  const contact = parseContact(values);
  if ('error' in contact) return { error: contact.error, values };
  const exists = await withTenant(scopeOf(ctx), (tx) =>
    tx.client.findFirst({
      where: { id: clientId.data, chamberId: ctx.chamberId, deletedAt: null },
      select: { id: true },
    }),
  );
  if (!exists) return { error: 'contactInvalid', values };
  await writeClientContact(ctx, clientId.data, { ...contact.contact, consent: contact.consent });
  redirect(`/clients/${clientId.data}`);
}
