import { NextResponse } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { addDays } from '@/lib/dates';
import { can } from '@/server/authz';
import { getCtx } from '@/server/context';
import { caseDisplay } from '@/features/cases/display';
import { hearingsOn, listCases, todayForStaff, type TodayHearing } from '@/features/cases/queries';
import type { OfflineHearing, OfflineSnapshot } from '@/features/offline/types';
import { listTasks } from '@/features/tasks/queries';

/**
 * What a phone keeps for offline use (F21, TECH_GUIDE section 11): today, tomorrow, own open tasks and
 * recent cases, already in the person's language. Same visibility as the screens; never client contact.
 */
export async function GET() {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: 'signedOut' }, { status: 401 });
  const t = await getTranslations();
  const d = await caseDisplay();
  const tomorrow = addDays(d.today, 1);

  const fromHearing = (h: TodayHearing): OfflineHearing => ({
    hearingId: h.hearingId,
    caseId: h.caseId,
    title: d.title(h),
    court: d.court(h.court, h.courtNo),
    serial: h.serial,
    party: h.clientName ? t('today.party', { side: t(`ourSide.${h.ourSide}`), name: h.clientName }) : null,
    canAddHearing: h.canAddHearing,
  });

  let todayList: OfflineHearing[];
  let tomorrowList: OfflineHearing[] = [];
  let cases: OfflineSnapshot['cases'] = [];
  if (can.listCases(ctx)) {
    const [a, b, recent] = await Promise.all([hearingsOn(ctx, d.today), hearingsOn(ctx, tomorrow), listCases(ctx)]);
    todayList = a.map(fromHearing);
    tomorrowList = b.map(fromHearing);
    cases = recent.slice(0, 60).map((c) => ({
      id: c.id,
      title: d.title(c),
      court: d.court(c.court, c.courtNo),
      party: c.clientName,
      next: c.nextDate ? d.long(c.nextDate) : null,
    }));
  } else {
    // Office staff: court, case number and serial only (P2, P3).
    todayList = (await todayForStaff(ctx)).map((h, i) => ({
      hearingId: `staff-${i}`,
      caseId: '',
      title: d.title(h),
      court: d.court(h.court, h.courtNo),
      serial: h.serial,
      party: null,
      canAddHearing: false,
    }));
  }
  const { open } = await listTasks(ctx);

  const body: OfflineSnapshot = {
    version: 1,
    generatedAt: new Date().toISOString(),
    userId: ctx.userId,
    chamberId: ctx.chamberId,
    role: ctx.role,
    canUploadOrders: ctx.role !== 'staff',
    today: { date: d.today, label: d.dayHeader(d.today), hearings: todayList },
    tomorrow: { date: tomorrow, label: d.dayHeader(tomorrow), hearings: tomorrowList },
    tasks: open
      .filter((x) => x.mine)
      .map((x) => ({ id: x.id, title: x.title, due: x.dueOn ? d.medium(x.dueOn) : null })),
    cases,
  };
  return NextResponse.json(body, { headers: { 'Cache-Control': 'private, no-store' } });
}
