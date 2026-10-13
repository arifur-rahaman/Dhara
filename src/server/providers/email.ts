import 'server-only';
import { appendFile } from 'node:fs/promises';
import { env } from '@/server/env';

export type EmailMessage = { to: string; subject: string; text: string };

export interface EmailProvider {
  send(message: EmailMessage, ref: string): Promise<{ id: string }>;
}

/** Development: prints the message to the server console. Refuses to run in production. */
const consoleProvider: EmailProvider = {
  async send(message, ref) {
    if (process.env.NODE_ENV === 'production') throw new Error('Console email provider is not allowed in production');
    console.info(`[email:console] to=${message.to} ref=${ref}\n${message.subject}\n${message.text}`);
    return { id: `console-${ref}` };
  },
};

/** Tests: appends JSON lines to EMAIL_OUTBOX_FILE so tests can read codes. Not for production. */
const fileProvider: EmailProvider = {
  async send(message, ref) {
    const file = env().EMAIL_OUTBOX_FILE;
    if (process.env.NODE_ENV === 'production' || !file) throw new Error('File email provider needs EMAIL_OUTBOX_FILE');
    await appendFile(file, `${JSON.stringify({ ...message, ref, at: new Date().toISOString() })}\n`);
    return { id: `file-${ref}` };
  },
};

/**
 * Resend (https://resend.com) over its HTTP API, so no SDK is needed. The sender address must be on a
 * domain verified with Resend. The message body is never logged.
 */
const resendProvider: EmailProvider = {
  async send(message, ref) {
    const { RESEND_API_KEY: key, EMAIL_FROM: from } = env();
    if (!key || !from) throw new Error('EMAIL_PROVIDER=resend needs RESEND_API_KEY and EMAIL_FROM');
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': ref },
      body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text }),
    });
    if (!res.ok) throw new Error(`Email not sent (status ${res.status})`);
    const body = (await res.json()) as { id?: string };
    return { id: body.id ?? ref };
  },
};

export function emailProvider(): EmailProvider {
  switch (env().EMAIL_PROVIDER) {
    case 'console':
      return consoleProvider;
    case 'file':
      return fileProvider;
    case 'resend':
      return resendProvider;
  }
}
