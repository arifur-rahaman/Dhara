import 'server-only';
import { addDays, dbDate, todayInDhaka, ymdFromDb } from '@/lib/dates';
import { can, type Ctx } from '@/server/authz';
import { decryptField } from '@/server/crypto';
import { scopeOf, withTenant } from '@/server/db/tenant';
import { env } from '@/server/env';
import { accessToken, calendarEnabled, upsertEvent } from '@/server/providers/google-calendar';
import { createTranslator } from 'next-intl';
import { isLocale, type Locale } from '@/i18n/config';
import en from '@/i18n/en.json';
import bn from '@/i18n/bn.json';
import { courtLabel } from '@/features/cases/format';
import { visibleCasesWhere } from '@/features/cases/queries';

const WINDOW_DAYS = 90;
const MIN_GAP_MS = 30 * 60 * 1000;

/**
 * Pushes this person's upcoming hearings (next 90 days, only cases they may see) to their own Google
 * Calendar (F8, one way). Runs as that person, so nobody's session ever touches another person's link.
 * Events carry case number, court, serial and a link back; never client names or contact.
 */
export async function syncMyCalendar(ctx: Ctx, opts: { force?: boolean } = {}) {
  if (!calendarEnabled() || !can.listCases(ctx)) return { synced: 0 };
  const link = await withTenant({ userId: ctx.userId }, (tx) =>
    tx.calendarLink.findUnique({ where: { userId: ctx.userId } }),
  );
  if (!link) return { synced: 0 };
  if (!opts.force && link.lastSyncedAt && Date.now() - link.lastSyncedAt.getTime() < MIN_GAP_MS) return { synced: 0 };

  const today = todayInDhaka();
  // Runs after the response (no request cookies), so the language comes from the person's account.
  const user = await withTenant({ userId: ctx.userId }, (tx) =>
    tx.user.findUnique({ where: { id: ctx.userId }, select: { locale: true } }),
  );
  const locale: Locale = isLocale(user?.locale) ? user.locale : 'bn';
  const t = createTranslator({ locale, messages: locale === 'bn' ? bn : en });
  const hearings = await withTenant(scopeOf(ctx), (tx) =>
    tx.hearing.findMany({
      where: {
        chamberId: ctx.chamberId,
        date: { gte: dbDate(today), lte: dbDate(addDays(today, WINDOW_DAYS)) },
        case: visibleCasesWhere(ctx),
      },
      select: {
        id: true,
        date: true,
        serialOrItem: true,
        case: { select: { id: true, type: true, number: true, year: true, courtNo: true, court: true } },
      },
      orderBy: { date: 'asc' },
      take: 500,
    }),
  );
  const known = new Map(
    (
      await withTenant({ userId: ctx.userId }, (tx) =>
        tx.calendarEvent.findMany({ where: { userId: ctx.userId, hearingId: { in: hearings.map((h) => h.id) } } }),
      )
    ).map((e) => [e.hearingId, e.eventId]),
  );

  try {
    const token = await accessToken(decryptField(link.refreshTokenEnc));
    let synced = 0;
    for (const h of hearings) {
      const title = `${t(`caseType.${h.case.type}`)} ${h.case.number}/${h.case.year}`;
      const court = courtLabel(
        h.case.court,
        h.case.courtNo,
        locale,
        (x) => t(`districts.${x}` as never),
        t('court.bench'),
      );
      const input = {
        summary: `${title} · ${court}`,
        description: [h.serialOrItem ? `#${h.serialOrItem}` : '', `${env().APP_URL}/cases/${h.case.id}`]
          .filter(Boolean)
          .join('\n'),
        date: ymdFromDb(h.date),
        hearingId: h.id,
      };
      let id = await upsertEvent(token, link.calendarId, known.get(h.id) ?? null, input);
      if (id === null) id = await upsertEvent(token, link.calendarId, null, input);
      await withTenant({ userId: ctx.userId }, (tx) =>
        tx.calendarEvent.upsert({
          where: { userId_hearingId: { userId: ctx.userId, hearingId: h.id } },
          create: { userId: ctx.userId, hearingId: h.id, eventId: id! },
          update: { eventId: id!, syncedAt: new Date() },
        }),
      );
      synced++;
    }
    await withTenant({ userId: ctx.userId }, (tx) =>
      tx.calendarLink.updateMany({ where: { userId: ctx.userId }, data: { lastSyncedAt: new Date() } }),
    );
    return { synced };
  } catch (e) {
    // Never log tokens or case details; the next sync tries again.
    console.error('[calendar] sync failed', e instanceof Error ? e.message : 'unknown');
    return { synced: 0, error: true as const };
  }
}
