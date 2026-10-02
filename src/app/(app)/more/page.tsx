import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ChevronRight } from 'lucide-react';
import { navByRole } from '@/features/shell/nav';
import { getPreviewRole } from '@/features/shell/preview-role';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('more');
  return { title: t('title') };
}

export default async function MorePage() {
  const role = await getPreviewRole();
  if (!role) redirect('/login');
  const t = await getTranslations();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="page-title">{t('more.title')}</h1>
      <ul className="overflow-hidden rounded-card border border-border bg-surface">
        {navByRole[role].more.map(({ section, href, icon: Icon }) => (
          <li key={section} className="border-b border-border last:border-b-0">
            <Link href={href} className="flex min-h-14 items-center gap-3 px-4 text-[16px] hover:bg-surface-2">
              <Icon aria-hidden="true" size={22} strokeWidth={1.8} className="text-muted" />
              <span className="flex-1">{t(`nav.${section}`)}</span>
              <ChevronRight aria-hidden="true" size={20} strokeWidth={1.8} className="text-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
