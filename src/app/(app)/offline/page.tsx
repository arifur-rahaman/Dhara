import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { requireCtx } from '@/server/context';
import { OfflineView } from '@/features/offline/offline-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('offline');
  return { title: t('title') };
}

/**
 * The page the service worker shows when a screen cannot load without internet (Offline design, F21).
 * Everything on it comes from this phone's saved snapshot and outbox.
 */
export default async function OfflinePage() {
  await requireCtx();
  return <OfflineView />;
}
