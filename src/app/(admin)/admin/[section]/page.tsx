import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { isAdminSection } from '@/features/admin-portal/nav';
import { previewEnabled } from '@/features/shell/preview-role';

export async function generateMetadata({ params }: PageProps<'/admin/[section]'>): Promise<Metadata> {
  const { section } = await params;
  if (!isAdminSection(section)) return {};
  const t = await getTranslations('admin.nav');
  return { title: t(section) };
}

export default async function AdminSectionPage({ params }: PageProps<'/admin/[section]'>) {
  if (!previewEnabled) notFound();
  const { section } = await params;
  if (!isAdminSection(section)) notFound();
  const t = await getTranslations('admin');
  return (
    <div className="flex flex-col gap-6">
      <h1 className="page-title">{t(`nav.${section}`)}</h1>
      <p className="rounded-card border border-border bg-surface p-5 text-muted">{t('placeholder')}</p>
    </div>
  );
}
