import { AppShell } from '@/features/shell/app-shell';
import { requireCtx } from '@/server/context';

export default async function ChamberAppLayout({ children }: LayoutProps<'/'>) {
  // Role comes from the signed-in membership (server-side), never from the client.
  const ctx = await requireCtx();
  return <AppShell role={ctx.role}>{children}</AppShell>;
}
