import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { listCourses } from '@/features/learning/queries';
import { getPreferences } from '@/features/preferences/server';
import { SubpageHeader } from '@/features/shell/subpage-header';
import { requireCtx } from '@/server/context';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('courses');
  return { title: t('title') };
}

/** Learning (Courses design, F24, F25): each course with this person's progress and its modules. Every role. */
export default async function CoursesPage() {
  const ctx = await requireCtx();
  const { locale } = await getPreferences();
  const t = await getTranslations('courses');
  const courses = await listCourses(ctx.userId, locale);

  return (
    <div className="flex max-w-[560px] flex-col gap-3">
      <SubpageHeader title={t('title')} />
      {courses.length === 0 && (
        <p className="rounded-card border border-border bg-surface p-4 text-[15px] text-muted">{t('none')}</p>
      )}
      {courses.map((c) => {
        const done = c.modules.filter((m) => m.done).length;
        const next = c.modules.find((m) => !m.done) ?? c.modules[0];
        return (
          <div key={c.id} className="flex flex-col gap-3">
            <article className="flex flex-col gap-2.5 rounded-card border border-border bg-surface p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-title text-[21px] leading-snug">{c.title}</h2>
                {c.free && (
                  <span className="shrink-0 rounded-full bg-ok-bg px-2.5 py-[3px] text-[12px] font-semibold text-ok">
                    {t('free')}
                  </span>
                )}
              </div>
              <span className="text-[13px] text-muted">{c.summary}</span>
              <div className="flex items-center gap-2.5">
                <div
                  role="progressbar"
                  aria-label={t('progress')}
                  aria-valuemin={0}
                  aria-valuemax={c.modules.length}
                  aria-valuenow={done}
                  className="flex h-2 grow rounded-[4px] bg-surface-2"
                >
                  <span
                    className="h-2 rounded-[4px] bg-accent"
                    style={{ width: `${c.modules.length ? (done / c.modules.length) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-[13px] font-semibold">{t('fraction', { done, total: c.modules.length })}</span>
              </div>
              {next && (
                <Link
                  href={`/courses/${next.id}`}
                  className="flex h-[46px] items-center justify-center rounded-control bg-accent text-[15px] font-semibold text-on-accent"
                >
                  {done === 0 ? t('start') : done === c.modules.length ? t('again') : t('continue')}
                </Link>
              )}
            </article>
            <section
              aria-label={t('modulesOf', { course: c.title })}
              className="flex flex-col rounded-card border border-border bg-surface px-4 py-2"
            >
              {c.modules.map((m, i) => {
                const current = !m.done && m.id === next?.id;
                return (
                  <Link
                    key={m.id}
                    href={`/courses/${m.id}`}
                    className={`flex min-h-11 items-center gap-3 py-1.5 ${i ? 'border-t border-border' : ''}`}
                  >
                    <span
                      aria-hidden="true"
                      className={`flex size-[26px] shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${
                        m.done ? 'bg-ok-bg text-ok' : current ? 'bg-accent text-on-accent' : 'bg-surface-2 text-muted'
                      }`}
                    >
                      {m.done ? <Check /> : t('number', { n: m.position })}
                    </span>
                    <span className={`text-[14px] ${current ? 'font-semibold' : ''}`}>{m.title}</span>
                    {m.done && <span className="sr-only">{t('doneLabel')}</span>}
                  </Link>
                );
              })}
            </section>
          </div>
        );
      })}
    </div>
  );
}

function Check() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}
