import { notFound } from 'next/navigation';
import { AdminShell } from '@/features/admin-portal/admin-shell';
import { adminPreviewEnabled } from '@/features/admin-portal/nav';

export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
  // No admin sign-in exists until M3, so the portal is development-only for now.
  if (!adminPreviewEnabled) notFound();
  return <AdminShell>{children}</AdminShell>;
}
