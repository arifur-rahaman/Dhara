import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { setModuleDone } from '@/features/learning/actions';
import { getModule } from '@/features/learning/queries';
import { videoEmbed } from '@/features/learning/video';
import { getPreferences } from '@/features/preferences/server';
import { SubpageHeader } from '@/features/shell/subpage-header';
import { requireCtx } from '@/server/context';

async function load(params: Promise<{ moduleId: string }>) {
  const ctx = await requireCtx();
  const { locale } = await getPreferences();
  const m = await getModule(ctx.userId, locale, (await params).moduleId);
  if (!m) notFound();
  return m;
}

export async function generateMetadata({ params }: PageProps<'/courses/[moduleId]'>): Promise<Metadata> {
  return { title: (await load(params)).title };
}

/** One module: the video (mobile-first player), what it covers, and "mark as done" (F25). */
export default async function ModulePage({ params }: PageProps<'/courses/[moduleId]'>) {
  const m = await load(params);
  const t = await getTranslations('courses');
  const video = videoEmbed(m.videoUrl);

  return (
    <div className="flex max-w-[640px] flex-col gap-3.5">
      <SubpageHeader title={m.courseTitle} backHref="/courses" heading={false} />
      <div className="flex flex-col gap-1">
        <span className="text-[13px] text-muted">{t('moduleOf', { n: m.position, total: m.count })}</span>
        <h1 className="font-title text-[24px] leading-snug">{m.title}</h1>
      </div>

      {video ? (
        <div className="overflow-hidden rounded-card border border-border bg-black">
          {video.kind === 'youtube' ? (
            <iframe
              src={video.src}
              title={m.title}
              className="aspect-video w-full"
              allow="encrypted-media; picture-in-picture; fullscreen"
              referrerPolicy="strict-origin-when-cross-origin"
              loading="lazy"
            />
          ) : (
            <video src={video.src} controls preload="metadata" playsInline className="aspect-video w-full" />
          )}
        </div>
      ) : (
        <p className="rounded-card border border-border bg-surface-2 p-4 text-[15px] leading-relaxed text-muted">
          {t('videoSoon')}
        </p>
      )}

      <section
        aria-labelledby="module-covers"
        className="flex flex-col gap-1.5 rounded-card border border-border bg-surface p-4"
      >
        <h2 id="module-covers" className="text-[15px] font-semibold">
          {t('covers')}
        </h2>
        <p className="text-[15px] leading-relaxed">{m.body}</p>
        {m.minutes && <p className="text-[13px] text-muted">{t('minutes', { n: m.minutes })}</p>}
      </section>

      <form action={setModuleDone}>
        <input type="hidden" name="moduleId" value={m.id} />
        <input type="hidden" name="done" value={m.done ? '0' : '1'} />
        <button
          type="submit"
          aria-pressed={m.done}
          className={`flex h-[50px] w-full items-center justify-center rounded-control text-[16px] font-semibold ${
            m.done ? 'border border-border bg-ok-bg text-ok' : 'bg-accent text-on-accent'
          }`}
        >
          {m.done ? t('markedDone') : t('markDone')}
        </button>
      </form>

      <nav aria-label={t('modulesNav')} className="flex justify-between gap-3">
        {m.prevId ? (
          <Link
            href={`/courses/${m.prevId}`}
            className="flex min-h-11 items-center text-[15px] font-semibold text-accent"
          >
            {t('prev')}
          </Link>
        ) : (
          <span />
        )}
        {m.nextId && (
          <Link
            href={`/courses/${m.nextId}`}
            className="flex min-h-11 items-center text-[15px] font-semibold text-accent"
          >
            {t('next')}
          </Link>
        )}
      </nav>
    </div>
  );
}
