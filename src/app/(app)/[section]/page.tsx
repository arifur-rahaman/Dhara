import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { canOpenSection, sectionMilestone } from '@/features/shell/nav';
import { PlaceholderScreen } from '@/features/shell/placeholder';
import { getPreviewRole } from '@/features/shell/preview-role';

async function resolveSection(params: Promise<{ section: string }>) {
  const { section } = await params;
  const role = await getPreviewRole();
  if (!role) redirect('/login');
  if (!canOpenSection(role, section)) notFound();
  return section;
}

export async function generateMetadata({ params }: PageProps<'/[section]'>): Promise<Metadata> {
  const section = await resolveSection(params);
  const t = await getTranslations('nav');
  return { title: t(section) };
}

/** Placeholder for every chamber screen that later milestones build. */
export default async function SectionPage({ params }: PageProps<'/[section]'>) {
  const section = await resolveSection(params);
  const t = await getTranslations('nav');
  return <PlaceholderScreen title={t(section)} milestone={sectionMilestone[section]} />;
}
