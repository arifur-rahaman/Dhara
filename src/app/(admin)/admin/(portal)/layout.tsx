import { requireAdmin } from '@/server/admin/session';
import { AdminShell } from '@/features/admin-portal/admin-shell';

export default async function AdminPortalLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <AdminShell name={admin.name} role={admin.role}>
      {children}
    </AdminShell>
  );
}
