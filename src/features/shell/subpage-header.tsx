import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Icon } from '@/components/icons';

/**
 * Header for screens opened from "More": back button and centred title on phones
 * (Settings, Notifications designs); a page title on the owner's web layout.
 */
export async function SubpageHeader({
  title,
  backHref = '/more',
  heading = true,
}: {
  title: string;
  backHref?: string;
  /** false when the page has its own h1 below (e.g. a case number) and this title is just a label. */
  heading?: boolean;
}) {
  const Title = heading ? 'h1' : 'p';
  const t = await getTranslations('app');
  return (
    <>
      <header className="-mx-3 -mt-4 flex h-14 items-center justify-between md:hidden">
        <Link
          href={backHref}
          aria-label={t('back')}
          className="flex size-11 items-center justify-center rounded-full text-text"
        >
          <Icon name="back" />
        </Link>
        <Title className="text-[17px] font-semibold">{title}</Title>
        <span className="size-11" aria-hidden="true" />
      </header>
      {heading && <h1 className="hidden page-title md:block">{title}</h1>}
    </>
  );
}
