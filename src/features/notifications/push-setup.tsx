'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { removePushSubscription, savePushSubscription } from './actions';

type State = 'loading' | 'unsupported' | 'ios' | 'denied' | 'off' | 'on' | 'busy';

function keyBytes(base64url: string) {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
const standalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as { standalone?: boolean }).standalone === true;

/** Turns Web Push on or off for this device (F5). The server stores only the endpoint and its keys. */
export function PushSetup({ publicKey }: { publicKey: string | null }) {
  const t = useTranslations('reminders');
  const [state, setState] = useState<State>('loading');

  useEffect(() => {
    (async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        return setState(isIos() && !standalone() ? 'ios' : 'unsupported');
      }
      if (Notification.permission === 'denied') return setState('denied');
      const reg = await navigator.serviceWorker.ready;
      setState((await reg.pushManager.getSubscription()) ? 'on' : 'off');
    })().catch(() => setState('unsupported'));
  }, []);

  async function enable() {
    if (!publicKey) return;
    setState('busy');
    try {
      if ((await Notification.requestPermission()) !== 'granted') return setState('denied');
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
      const ok = (await savePushSubscription(sub.toJSON(), navigator.userAgent)).ok;
      setState(ok ? 'on' : 'off');
    } catch {
      setState('off');
    }
  }

  async function disable() {
    setState('busy');
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await removePushSubscription(sub.endpoint);
      await sub.unsubscribe();
    }
    setState('off');
  }

  const note = (text: string) => <p className="py-3 text-[14px] text-muted">{text}</p>;
  if (!publicKey) return note(t('notConfigured'));
  if (state === 'loading') return null;
  if (state === 'unsupported') return note(t('unsupported'));
  if (state === 'ios') return note(t('iosTip'));
  if (state === 'denied') return note(t('denied'));
  return (
    <div className="flex flex-col gap-2 py-3">
      {state === 'on' && (
        <p role="status" className="text-[14px] text-ok">
          {t('enabled')}
        </p>
      )}
      <button
        type="button"
        disabled={state === 'busy'}
        onClick={state === 'on' ? disable : enable}
        className={`h-12 rounded-control text-[16px] font-semibold disabled:opacity-60 ${
          state === 'on' ? 'border border-border' : 'bg-accent text-on-accent'
        }`}
      >
        {state === 'on' ? t('disable') : t('enable')}
      </button>
    </div>
  );
}

/** Sign-out that first forgets this device's push subscription, so a shared phone stops getting reminders. */
export function SignOutButton({
  action,
  label,
  className,
}: {
  action: () => Promise<void>;
  label: string;
  className: string;
}) {
  return (
    <form
      action={async () => {
        try {
          const reg = await navigator.serviceWorker?.getRegistration();
          const sub = await reg?.pushManager.getSubscription();
          if (sub) {
            await removePushSubscription(sub.endpoint);
            await sub.unsubscribe();
          }
        } catch {
          // Signing out must never fail because of push.
        }
        await action();
      }}
    >
      <button className={className}>{label}</button>
    </form>
  );
}
