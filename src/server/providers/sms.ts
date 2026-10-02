import 'server-only';
import { appendFile } from 'node:fs/promises';
import { env } from '@/server/env';

export type E164 = `+${string}`;

export interface SmsProvider {
  send(to: E164, text: string, ref: string): Promise<{ id: string }>;
}

/** Development: prints the message to the server console. Refuses to run in production. */
const consoleProvider: SmsProvider = {
  async send(to, text, ref) {
    if (process.env.NODE_ENV === 'production') throw new Error('Console SMS provider is not allowed in production');
    console.info(`[sms:console] to=${to} ref=${ref}\n${text}`);
    return { id: `console-${ref}` };
  },
};

/** Tests: appends JSON lines to SMS_OUTBOX_FILE so end-to-end tests can read codes. Not for production. */
const fileProvider: SmsProvider = {
  async send(to, text, ref) {
    const file = process.env.SMS_OUTBOX_FILE;
    if (process.env.NODE_ENV === 'production' || !file) throw new Error('File SMS provider needs SMS_OUTBOX_FILE');
    await appendFile(file, `${JSON.stringify({ to, text, ref, at: new Date().toISOString() })}\n`);
    return { id: `file-${ref}` };
  },
};

export function smsProvider(): SmsProvider {
  switch (env().SMS_PROVIDER) {
    case 'console':
      return consoleProvider;
    case 'file':
      return fileProvider;
  }
}
