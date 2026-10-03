import { NextResponse, type NextRequest } from 'next/server';
import { adminHost, adminPortalAllowedOnHost, clientIp, ipAllowed } from '@/server/admin/access';

/**
 * Host routing (TECH_GUIDE section 5): the admin portal lives on ADMIN_URL, the chamber app on APP_URL.
 * /admin on the app host is a 404; on the admin host every other page goes to /admin.
 * The admin host also checks the IP allowlist. The admin layout repeats these checks.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get('host');
  const isAdminPath = pathname === '/admin' || pathname.startsWith('/admin/');
  const admin = adminHost();
  const onAdminHost = !!admin && host === admin;

  if (onAdminHost && !isAdminPath) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }
  if (isAdminPath) {
    if (!adminPortalAllowedOnHost(host) || !ipAllowed(clientIp(request.headers))) {
      return new NextResponse('Not found', { status: 404 });
    }
  }
  return NextResponse.next();
}

export const config = {
  // Pages only: static files, images and the service worker are served on both hosts.
  matcher: ['/((?!_next/|sw\\.js|manifest\\.webmanifest|icon|apple-icon|favicon|icons/).*)'],
};
