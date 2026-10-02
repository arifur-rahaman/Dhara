import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Icon } from '@/components/icons';
import { navByRole } from '@/features/shell/nav';
import { requireCtx } from '@/server/context';
import { signOut } from '@/features/auth/actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('more');
  return { title: t('title') };
}

export default async function MorePage() {
  const { role } = await requireCtx();
  const t = await getTranslations();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="page-title">{t('more.title')}</h1>
      <ul className="overflow-hidden rounded-card border border-border bg-surface">
        {navByRole[role].more.map(({ section, href, icon }) => (
          <li key={section} className="border-b border-border last:border-b-0">
            <Link href={href} className="flex min-h-14 items-center gap-3 px-4 text-[16px] hover:bg-surface-2">
              <Icon name={icon} className="text-muted" />
              <span className="flex-1">{t(`nav.${section}`)}</span>
              <Icon name="chevron" size={20} className="text-muted" />
            </Link>
          </li>
        ))}
      </ul>
      <form action={signOut}>
        <button className="flex min-h-14 w-full items-center rounded-card border border-border bg-surface px-4 text-[16px] font-semibold text-lock-text">
          {t('settings.signOut')}
        </button>
      </form>
    </div>
  );
}
