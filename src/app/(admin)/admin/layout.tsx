import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { adminPortalAllowedOnHost, clientIp, ipAllowed } from '@/server/admin/access';

/** Second check after src/proxy.ts: the portal answers only on ADMIN_URL and from allowed IPs. */
export default async function AdminRootLayout({ children }: LayoutProps<'/admin'>) {
  const h = await headers();
  if (!adminPortalAllowedOnHost(h.get('host')) || !ipAllowed(clientIp(h))) notFound();
  return children;
}
