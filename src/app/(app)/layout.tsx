import { AppShell } from '@/features/shell/app-shell';
import { getSession } from '@/server/auth/session';
import { requireCtx } from '@/server/context';

export default async function ChamberAppLayout({ children }: LayoutProps<'/'>) {
  // Role comes from the signed-in membership (server-side), never from the client.
  const ctx = await requireCtx();
  const textSize = (await getSession())?.user.textSize;
  return (
    <AppShell role={ctx.role} textSize={textSize === 'sm' || textSize === 'lg' ? textSize : 'md'}>
      {children}
    </AppShell>
  );
}
