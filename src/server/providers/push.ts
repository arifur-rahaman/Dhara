import 'server-only';
import webpush from 'web-push';
import { env } from '@/server/env';

/** Web Push with VAPID (TECH_GUIDE section 12). Messages must never carry client names or case details. */
export type PushTarget = { endpoint: string; p256dh: string; auth: string };
export type PushMessage = { title: string; body: string; url: string; tag: string };
export type PushResult = 'sent' | 'gone' | 'failed';

let configured = false;

export function pushConfigured() {
  const e = env();
  return !!(e.VAPID_PUBLIC_KEY && e.VAPID_PRIVATE_KEY && e.VAPID_SUBJECT);
}

export async function sendPush(target: PushTarget, message: PushMessage): Promise<PushResult> {
  const e = env();
  if (!pushConfigured()) return 'failed';
  if (!configured) {
    webpush.setVapidDetails(e.VAPID_SUBJECT!, e.VAPID_PUBLIC_KEY!, e.VAPID_PRIVATE_KEY!);
    configured = true;
  }
  try {
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify(message),
      { TTL: 6 * 60 * 60, urgency: 'normal' },
    );
    return 'sent';
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    // 404/410: the browser dropped this subscription; it will never work again.
    return status === 404 || status === 410 ? 'gone' : 'failed';
  }
}
