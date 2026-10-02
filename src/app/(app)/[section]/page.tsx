import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { canOpenSection, navByRole, sectionMilestone } from '@/features/shell/nav';
import { PlaceholderScreen } from '@/features/shell/placeholder';
import { requireCtx } from '@/server/context';

async function resolveSection(params: Promise<{ section: string }>) {
  const { section } = await params;
  const { role } = await requireCtx();
  if (!canOpenSection(role, section)) notFound();
  return { section, isTab: navByRole[role].tabs.some((tab) => tab.section === section) };
}

export async function generateMetadata({ params }: PageProps<'/[section]'>): Promise<Metadata> {
  const { section } = await resolveSection(params);
  const t = await getTranslations('nav');
  return { title: t(section) };
}

/** Placeholder for every chamber screen that later milestones build. */
export default async function SectionPage({ params }: PageProps<'/[section]'>) {
  const { section, isTab } = await resolveSection(params);
  const t = await getTranslations('nav');
  return <PlaceholderScreen title={t(section)} milestone={sectionMilestone[section]} subpage={!isTab} />;
}
