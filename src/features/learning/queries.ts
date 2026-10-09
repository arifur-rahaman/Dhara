import 'server-only';
import type { Locale } from '@/i18n/config';
import { withTenant } from '@/server/db/tenant';

export type ModuleItem = { id: string; position: number; title: string; done: boolean };
export type CourseItem = { id: string; title: string; summary: string; free: boolean; modules: ModuleItem[] };

/** Published courses with this person's own progress (F24, F25). Progress is personal: RLS shows only theirs. */
export async function listCourses(userId: string, locale: Locale): Promise<CourseItem[]> {
  return withTenant({ userId }, async (tx) => {
    const courses = await tx.course.findMany({
      where: { published: true },
      orderBy: { position: 'asc' },
      include: {
        modules: { orderBy: { position: 'asc' }, select: { id: true, position: true, titleEn: true, titleBn: true } },
      },
    });
    const done = new Set(
      (await tx.courseProgress.findMany({ where: { userId }, select: { moduleId: true } })).map((p) => p.moduleId),
    );
    return courses.map((c) => ({
      id: c.id,
      title: locale === 'bn' ? c.titleBn : c.titleEn,
      summary: locale === 'bn' ? c.summaryBn : c.summaryEn,
      free: c.free,
      modules: c.modules.map((m) => ({
        id: m.id,
        position: m.position,
        title: locale === 'bn' ? m.titleBn : m.titleEn,
        done: done.has(m.id),
      })),
    }));
  });
}

export type ModuleDetail = {
  id: string;
  courseTitle: string;
  position: number;
  count: number;
  title: string;
  body: string;
  videoUrl: string | null;
  minutes: number | null;
  done: boolean;
  prevId: string | null;
  nextId: string | null;
};

export async function getModule(userId: string, locale: Locale, id: string): Promise<ModuleDetail | null> {
  return withTenant({ userId }, async (tx) => {
    const m = await tx.courseModule.findFirst({
      where: { id, course: { published: true } },
      include: { course: { include: { modules: { orderBy: { position: 'asc' }, select: { id: true } } } } },
    });
    if (!m) return null;
    const siblings = m.course.modules.map((s) => s.id);
    const index = siblings.indexOf(m.id);
    const done = await tx.courseProgress.findUnique({ where: { userId_moduleId: { userId, moduleId: m.id } } });
    return {
      id: m.id,
      courseTitle: locale === 'bn' ? m.course.titleBn : m.course.titleEn,
      position: index + 1,
      count: siblings.length,
      title: locale === 'bn' ? m.titleBn : m.titleEn,
      body: locale === 'bn' ? m.bodyBn : m.bodyEn,
      videoUrl: m.videoUrl,
      minutes: m.minutes,
      done: !!done,
      prevId: siblings[index - 1] ?? null,
      nextId: siblings[index + 1] ?? null,
    };
  });
}
