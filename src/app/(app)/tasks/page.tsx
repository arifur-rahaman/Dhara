import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { can } from '@/server/authz';
import { requireCtx } from '@/server/context';
import { SubpageHeader } from '@/features/shell/subpage-header';
import { listTasks, taskAssignees } from '@/features/tasks/queries';
import { TaskList } from '@/features/tasks/task-list';
import { TaskForm } from './task-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav');
  return { title: t('tasks') };
}

/** Tasks (P11): the owner assigns and sees all; others see their own. */
export default async function TasksPage() {
  const ctx = await requireCtx();
  const t = await getTranslations();
  const owner = can.assignTask(ctx);
  const [{ open, done }, assignees] = await Promise.all([listTasks(ctx), taskAssignees(ctx)]);

  return (
    <div className="flex max-w-[640px] flex-col gap-5">
      <SubpageHeader title={t('nav.tasks')} />
      {owner && (
        <TaskForm
          // Others first, so the default is a team member rather than the owner.
          assignees={[
            ...assignees.filter((a) => a.userId !== ctx.userId),
            ...assignees.filter((a) => a.userId === ctx.userId),
          ].map((a) => ({
            id: a.id,
            label: a.userId === ctx.userId ? t('team.you') : `${a.user.name ?? ''} · ${t(`roles.${a.role}`)}`,
          }))}
        />
      )}
      <section aria-labelledby="tasks-open" className="flex flex-col gap-2">
        <h2 id="tasks-open" className="text-[16px] font-semibold">
          {owner ? t('tasks.openAll') : t('tasks.openMine')}
        </h2>
        {open.length === 0 ? (
          <p className="rounded-card border border-border bg-surface p-4 text-[15px] text-muted">{t('tasks.none')}</p>
        ) : (
          <TaskList items={open} showAssignee={owner} />
        )}
      </section>
      {done.length > 0 && (
        <section aria-labelledby="tasks-done" className="flex flex-col gap-2">
          <h2 id="tasks-done" className="text-[16px] font-semibold">
            {t('tasks.doneRecent')}
          </h2>
          <TaskList items={done} showAssignee={owner} />
        </section>
      )}
    </div>
  );
}
