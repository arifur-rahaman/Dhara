import { beforeEach, describe, expect, it, vi } from 'vitest';

/** The scheduler endpoint (Vercel): only a caller with CRON_SECRET may run the tick. */
const ran = vi.hoisted(() => ({ count: 0 }));
vi.mock('@/server/jobs/reminders', () => ({
  runReminderTick: async () => {
    ran.count++;
    return 2;
  },
  runNoticeTick: async () => 1,
}));
const SECRET = 'cron-secret-cron-secret-cron-secret-0001';
process.env.CRON_SECRET = SECRET;
const { GET } = await import('@/app/api/jobs/tick/route');
const call = (auth?: string) =>
  GET(new Request('http://localhost/api/jobs/tick', { headers: auth ? { authorization: auth } : {} }));

describe('/api/jobs/tick', () => {
  beforeEach(() => {
    ran.count = 0;
  });

  it('is a 404 without the right secret, and runs nothing', async () => {
    for (const auth of [undefined, 'Bearer wrong', `Bearer ${SECRET}x`, SECRET.slice(0, 10)]) {
      expect((await call(auth)).status).toBe(404);
    }
    expect(ran.count).toBe(0);
  });

  it('runs the reminder and notice ticks with the secret', async () => {
    const res = await call(`Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reminders: 2, notices: 1 });
    expect(ran.count).toBe(1);
  });
});
