import { notFound } from 'next/navigation';
import { AdminShell } from '@/features/admin-portal/admin-shell';
import { previewEnabled } from '@/features/shell/preview-role';

export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
  // No admin sign-in exists until M3, so the portal is development-only for now.
  if (!previewEnabled) notFound();
  return <AdminShell>{children}</AdminShell>;
}
