'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { roles } from './nav';
import { PREVIEW_ROLE_COOKIE, previewEnabled } from './preview-role';

export async function previewAsRole(formData: FormData) {
  if (!previewEnabled) throw new Error('Not available');
  const role = z.enum(roles).parse(formData.get('role'));
  (await cookies()).set(PREVIEW_ROLE_COOKIE, role, { httpOnly: true, sameSite: 'lax', path: '/' });
  redirect('/today');
}
