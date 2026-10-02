import 'server-only';
import { cookies } from 'next/headers';

export const INVITE_COOKIE = 'dhara_invite';

/** Where to go once signed in: back to a pending invitation, or into the app (which routes onward). */
export async function afterSignInPath(): Promise<string> {
  const token = (await cookies()).get(INVITE_COOKIE)?.value;
  return token && /^[\w-]{20,100}$/.test(token) ? `/invite/${token}` : '/today';
}
