import { redirect } from 'next/navigation';
import { AppShell } from '@/features/shell/app-shell';
import { getPreviewRole } from '@/features/shell/preview-role';

export default async function ChamberAppLayout({ children }: LayoutProps<'/'>) {
  // M0: development preview only. M1 replaces this with the signed-in membership.
  const role = await getPreviewRole();
  if (!role) redirect('/login');
  return <AppShell role={role}>{children}</AppShell>;
}
