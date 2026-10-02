import 'server-only';
import { cookies } from 'next/headers';
import { isRole, type Role } from './nav';

export const PREVIEW_ROLE_COOKIE = 'dhara_preview_role';

export const previewEnabled = process.env.NODE_ENV !== 'production';

/**
 * M0 has no sign-in yet, so the shell is previewed with a development-only
 * cookie. From M1 the role comes from the signed-in user's membership and this
 * file is removed. Always null in production.
 */
export async function getPreviewRole(): Promise<Role | null> {
  if (!previewEnabled) return null;
  const value = (await cookies()).get(PREVIEW_ROLE_COOKIE)?.value;
  return isRole(value) ? value : null;
}
