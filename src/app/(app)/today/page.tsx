import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Icon } from '@/components/icons';
import { addDays, todayInDhaka } from '@/lib/dates';
import { can } from '@/server/authz';
import { requireCtx } from '@/server/context';
import { caseDisplay } from '@/features/cases/display';
import { supportBanner } from '@/features/support/queries';
import { listTasks } from '@/features/tasks/queries';
import { TaskList } from '@/features/tasks/task-list';
import { countHearingsOn, hearingsOn, todayForStaff, type TodayHearing } from '@/features/cases/queries';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav');
  return { title: t('today') };
}

/** Today (F3, F4): OwnerToday, MunshiToday and StaffToday designs; associates get the munshi layout for their cases. */
export default async function TodayPage() {
  const ctx = await requireCtx();
  if (ctx.role === 'staff') return <StaffToday />;
  if (ctx.role === 'owner') return <OwnerToday />;
  return <MemberToday lockNote={ctx.role === 'munshi'} role={ctx.role} />;
}

async function OwnerToday() {
  const ctx = await requireCtx();
  const t = await getTranslations();
  const d = await caseDisplay();
  const [hearings, tomorrow, support] = await Promise.all([
    hearingsOn(ctx, d.today),
    countHearingsOn(ctx, addDays(d.today, 1)),
    supportBanner(ctx),
  ]);

  return (
    <div className="relative flex flex-col gap-4">
      <header className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-[14px] text-muted">{d.dayHeader(d.today)}</span>
          <h1 className="page-title">{t('today.ownerTitle')}</h1>
        </div>
        <Link
          href="/notifications"
          aria-label={t('nav.notifications')}
          className="flex size-11 items-center justify-center rounded-full border border-border bg-surface"
        >
          <Icon name="notifications" size={20} />
        </Link>
      </header>

      {(support.pending > 0 || support.active) && (
        <Link
          href="/support"
          className="flex min-h-14 items-center gap-3 rounded-[14px] bg-lock-bg px-4 py-3 text-[15px] text-lock-text md:max-w-[560px]"
        >
          <Icon name="shield" size={22} className="shrink-0" />
          <span className="flex-1 font-semibold">
            {support.pending > 0
              ? t('support.bannerPending')
              : t('support.bannerActive', { name: support.active!.adminName })}
          </span>
          <Icon name="chevron" size={18} className="shrink-0" />
        </Link>
      )}

      <div className="grid grid-cols-2 gap-2.5 md:max-w-[420px]">
        <Stat value={d.number(hearings.length)} label={t('today.statToday')} />
        <Stat value={d.number(tomorrow)} label={t('today.statTomorrow')} />
      </div>

      <section aria-labelledby="today-hearings" className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 id="today-hearings" className="text-[16px] font-semibold">
            {t('today.hearingsTitle')}
          </h2>
          <Link href="/cases?filter=today" className="text-[14px] font-semibold text-accent">
            {t('today.seeAll')}
          </Link>
        </div>
        {hearings.length === 0 ? (
          <p className="rounded-card border border-border bg-surface p-4 text-[15px] text-muted">{t('today.none')}</p>
        ) : (
          <ul className="flex flex-col rounded-card border border-border bg-surface px-4">
            {hearings.map((h) => (
              <li key={h.hearingId} className="border-t border-border first:border-t-0">
                <Link href={`/cases/${h.caseId}`} className="flex min-h-[68px] items-center gap-3 py-2">
                  <SerialChip label={h.serial ? t('today.serial', { serial: h.serial }) : '—'} />
                  <span className="flex min-w-0 flex-1 flex-col gap-px">
                    <span className="text-[15px] font-semibold">{d.title(h)}</span>
                    <span className="text-[13px] text-muted">{d.court(h.court, h.courtNo)}</span>
                  </span>
                  <span className="shrink-0 text-[12px] text-muted">{firstName(h.assigneeName)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {can.createCase(ctx) && (
        <Link
          href="/cases/new"
          aria-label={t('today.addCase')}
          className="fixed right-5 bottom-[calc(var(--spacing-tabbar)+20px)] z-10 flex size-14 items-center justify-center rounded-full bg-accent text-on-accent shadow-[0_6px_16px_rgba(0,0,0,0.18)] md:right-10 md:bottom-10"
        >
          <span aria-hidden="true" className="text-[28px] leading-none">
            +
          </span>
        </Link>
      )}
    </div>
  );
}

async function MemberToday({ lockNote, role }: { lockNote: boolean; role: 'associate' | 'munshi' }) {
  const ctx = await requireCtx();
  const t = await getTranslations();
  const d = await caseDisplay();
  const hearings = await hearingsOn(ctx, d.today);
  const courts = new Set(hearings.map((h) => d.court(h.court, h.courtNo))).size;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[14px] text-muted">{d.dayHeader(d.today)}</span>
          <RoleChip label={t(`roles.${role}`)} />
        </div>
        <h1 className="page-title">{t('today.hearingsTitle')}</h1>
        <p className="text-[14px] text-muted">{t('today.summary', { hearings: hearings.length, courts })}</p>
      </header>

      {hearings.length === 0 ? (
        <p className="rounded-card border border-border bg-surface p-4 text-[15px] text-muted">{t('today.none')}</p>
      ) : (
        hearings.map((h) => <HearingCard key={h.hearingId} h={h} display={d} />)
      )}

      {lockNote && <LockNote text={t('today.munshiLock')} />}
    </div>
  );
}

async function HearingCard({ h, display: d }: { h: TodayHearing; display: Awaited<ReturnType<typeof caseDisplay>> }) {
  const t = await getTranslations();
  return (
    <article className="flex flex-col gap-2 rounded-card border border-border bg-surface px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] text-muted">{d.court(h.court, h.courtNo)}</span>
        {h.serial && (
          <span className="shrink-0 rounded-[8px] bg-accent-soft px-2.5 py-[3px] text-[12px] font-semibold text-accent">
            {t('today.serial', { serial: h.serial })}
          </span>
        )}
      </div>
      <Link href={`/cases/${h.caseId}`} className="text-[16px] font-semibold">
        {d.title(h)}
      </Link>
      {h.clientName && (
        <span className="text-[14px] text-muted">
          {t('today.party', { side: t(`ourSide.${h.ourSide}`), name: h.clientName })}
        </span>
      )}
      {h.canAddHearing && (
        <Link
          href={`/cases/${h.caseId}/next-date`}
          className="flex h-11 items-center justify-center rounded-[10px] bg-accent text-[14px] font-semibold text-on-accent"
        >
          {t('today.addNextDate')}
        </Link>
      )}
    </article>
  );
}

async function StaffToday() {
  const ctx = await requireCtx();
  const t = await getTranslations();
  const d = await caseDisplay();
  const [items, { open, done }] = await Promise.all([todayForStaff(ctx), listTasks(ctx)]);
  // Open tasks, then those finished today (StaffToday design shows both).
  const tasks = [...open, ...done.filter((x) => x.doneAt && todayInDhaka(x.doneAt) === d.today)];
  const byCourt = new Map<string, typeof items>();
  for (const item of items) {
    const key = d.court(item.court, item.courtNo);
    byCourt.set(key, [...(byCourt.get(key) ?? []), item]);
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[14px] text-muted">{d.dayHeader(d.today)}</span>
          <RoleChip label={t('roles.staff')} />
        </div>
        <h1 className="page-title">{t('today.staffTitle')}</h1>
      </header>

      <section aria-labelledby="staff-tasks" className="flex flex-col gap-2">
        <h2 id="staff-tasks" className="text-[16px] font-semibold">
          {t('today.staffTasks')}
        </h2>
        {tasks.length === 0 ? (
          <p className="rounded-card border border-border bg-surface p-4 text-[15px] text-muted">{t('tasks.none')}</p>
        ) : (
          <TaskList items={tasks} showAssignee={false} />
        )}
      </section>

      <section aria-labelledby="staff-courts" className="flex flex-col gap-2">
        <h2 id="staff-courts" className="text-[16px] font-semibold">
          {t('today.staffCourts')}
        </h2>
        {items.length === 0 ? (
          <p className="rounded-card border border-border bg-surface p-4 text-[15px] text-muted">{t('today.none')}</p>
        ) : (
          <ul className="flex flex-col rounded-card border border-border bg-surface px-4">
            {[...byCourt.entries()].map(([court, list]) => (
              <li key={court} className="flex flex-col gap-1 border-t border-border py-3.5 first:border-t-0">
                <span className="text-[15px] font-semibold">{court}</span>
                <span className="text-[14px] text-muted">
                  {list
                    .map((i) => (i.serial ? `${d.title(i)} (${t('today.serial', { serial: i.serial })})` : d.title(i)))
                    .join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <LockNote text={t('today.staffLock')} />
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-[14px] border border-border bg-surface p-3">
      <span className="text-[24px] font-bold">{value}</span>
      <span className="text-[13px] text-muted">{label}</span>
    </div>
  );
}

function SerialChip({ label }: { label: string }) {
  return (
    <span className="w-[68px] shrink-0 rounded-[8px] bg-accent-soft py-1 text-center text-[12px] font-semibold text-accent">
      {label}
    </span>
  );
}

function RoleChip({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-surface-2 py-[5px] pr-3 pl-2.5 text-[13px] font-semibold">
      <Icon name="clients" size={16} />
      {label}
    </span>
  );
}

function LockNote({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-2 px-1 text-[13px] text-muted">
      <Icon name="lock" size={16} className="mt-[3px] shrink-0" />
      <span>{text}</span>
    </p>
  );
}

function firstName(name: string | null) {
  if (!name) return '';
  const parts = name.replace(/^(অ্যাড\.|Adv\.|Advocate|মোঃ|Md\.)\s*/i, '').split(/\s+/);
  return parts[0] ?? '';
}
