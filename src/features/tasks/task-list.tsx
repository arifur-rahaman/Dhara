import { getTranslations } from 'next-intl/server';
import { Icon } from '@/components/icons';
import { formatDate } from '@/i18n/format';
import { dbDate } from '@/lib/dates';
import { getPreferences } from '@/features/preferences/server';
import { toggleTask } from './actions';
import type { TaskItem } from './queries';

/** Task checklist (StaffToday design): tick button, title, who gave it and when it is due or was done. */
export async function TaskList({ items, showAssignee }: { items: TaskItem[]; showAssignee: boolean }) {
  const t = await getTranslations('tasks');
  const prefs = await getPreferences();
  const day = (ymd: string) => formatDate(dbDate(ymd), prefs, { day: 'numeric', month: 'long' });
  const time = (d: Date) =>
    formatDate(d, prefs, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

  return (
    <ul className="flex flex-col rounded-card border border-border bg-surface px-4">
      {items.map((task) => {
        const done = !!task.doneAt;
        const meta = [
          showAssignee && task.assigneeName ? t('to', { name: task.assigneeName }) : null,
          task.createdByName ? t('from', { name: task.createdByName }) : null,
          done ? t('doneAt', { time: time(task.doneAt!) }) : task.dueOn ? t('due', { date: day(task.dueOn) }) : null,
        ].filter(Boolean);
        return (
          <li key={task.id} className="flex items-start gap-3 border-t border-border py-3 first:border-t-0">
            <form action={toggleTask}>
              <input type="hidden" name="taskId" value={task.id} />
              <input type="hidden" name="done" value={done ? '0' : '1'} />
              <button
                aria-label={done ? t('reopen', { title: task.title }) : t('markDone', { title: task.title })}
                className="-m-2.5 flex size-11 items-center justify-center"
              >
                <span
                  className={`flex size-6 items-center justify-center rounded-[7px] border-2 ${done ? 'border-accent bg-accent text-on-accent' : 'border-border bg-surface'}`}
                >
                  {done && <Icon name="check" size={16} />}
                </span>
              </button>
            </form>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className={`text-[15px] ${done ? 'text-muted line-through' : 'font-semibold'}`}>{task.title}</span>
              {meta.length > 0 && <span className="text-[13px] text-muted">{meta.join(' · ')}</span>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
