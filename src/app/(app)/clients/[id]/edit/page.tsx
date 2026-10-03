import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { isUuid } from '@/lib/ids';
import { can } from '@/server/authz';
import { requireCtx } from '@/server/context';
import { scopeOf, withTenant } from '@/server/db/tenant';
import { ClientForm } from '@/features/clients/client-form';
import { readClientContact } from '@/features/clients/contact';
import { getClient } from '@/features/clients/queries';
import { SubpageHeader } from '@/features/shell/subpage-header';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('client');
  return { title: t('editTitle') };
}

/** Owner edits client contact (P1). */
export default async function EditClientPage({ params }: PageProps<'/clients/[id]/edit'>) {
  const ctx = await requireCtx();
  if (!can.editClientContact(ctx)) notFound();
  const { id } = await params;
  const client = isUuid(id) ? await getClient(ctx, id) : null;
  if (!client) notFound();
  const contact = await readClientContact(ctx, id);
  const consent = await withTenant(scopeOf(ctx), (tx) =>
    tx.clientContact.findUnique({ where: { clientId: id }, select: { consentAt: true } }),
  );
  const t = await getTranslations('client');
  return (
    <div className="flex max-w-[520px] flex-col gap-3">
      <SubpageHeader title={t('editTitle')} backHref={`/clients/${id}`} />
      <p className="text-[17px] font-semibold">{client.name}</p>
      <ClientForm
        mode="edit"
        clientId={id}
        showContact
        initial={{ ...contact, phone: contact?.phone?.replace(/^\+88/, '') ?? null, consent: !!consent?.consentAt }}
      />
    </div>
  );
}
