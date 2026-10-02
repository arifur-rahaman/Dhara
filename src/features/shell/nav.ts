import {
  BarChart3,
  Bell,
  BookOpen,
  Briefcase,
  CalendarDays,
  CircleEllipsis,
  FileText,
  Folder,
  ListChecks,
  Settings,
  Sun,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export const roles = ['owner', 'associate', 'munshi', 'staff'] as const;
export type Role = (typeof roles)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (roles as readonly string[]).includes(value);
}

export type Section =
  | 'today'
  | 'cases'
  | 'clients'
  | 'accounts'
  | 'more'
  | 'drafts'
  | 'calendar'
  | 'tasks'
  | 'documents'
  | 'team'
  | 'reports'
  | 'courses'
  | 'notifications'
  | 'settings';

export type NavItem = { section: Section; href: `/${string}`; icon: LucideIcon };

const item = (section: Section, icon: LucideIcon): NavItem => ({ section, href: `/${section}`, icon });

const today = item('today', Sun);
const cases = item('cases', Briefcase);
const clients = item('clients', Users);
const accounts = item('accounts', Wallet);
const more = item('more', CircleEllipsis);
const drafts = item('drafts', FileText);
const calendar = item('calendar', CalendarDays);
const tasks = item('tasks', ListChecks);
const documents = item('documents', Folder);
const team = item('team', UsersRound);
const reports = item('reports', BarChart3);
const courses = item('courses', BookOpen);
const notifications = item('notifications', Bell);
const settings = item('settings', Settings);

/**
 * Navigation per role. Owner tabs come from CLAUDE.md; the associate, munshi
 * and staff tabs follow the counts in plan.md M0 (5, 4, 3) and the permission
 * matrix, and must be checked against docs/design once those files are added.
 *
 * Navigation is cosmetic: the server decides access (src/server/authz, from M1).
 */
export const navByRole: Record<Role, { tabs: NavItem[]; more: NavItem[]; sidebar: NavItem[] | null }> = {
  owner: {
    tabs: [today, cases, clients, accounts, more],
    more: [calendar, tasks, documents, drafts, team, reports, courses, notifications, settings],
    sidebar: [
      today,
      cases,
      calendar,
      clients,
      accounts,
      documents,
      tasks,
      drafts,
      team,
      reports,
      courses,
      notifications,
      settings,
    ],
  },
  associate: {
    tabs: [today, cases, clients, drafts, more],
    more: [calendar, tasks, documents, courses, notifications, settings],
    sidebar: null,
  },
  munshi: {
    tabs: [today, cases, calendar, more],
    more: [tasks, documents, courses, notifications, settings],
    sidebar: null,
  },
  staff: {
    tabs: [today, tasks, more],
    more: [courses, notifications, settings],
    sidebar: null,
  },
};

/** Milestone (plan.md section 9) that builds each placeholder screen. */
export const sectionMilestone: Record<Section, string> = {
  today: 'M2',
  cases: 'M2',
  clients: 'M2',
  calendar: 'M2',
  accounts: 'M4',
  documents: 'M4',
  reports: 'M4',
  tasks: 'M3',
  team: 'M3',
  notifications: 'M5',
  courses: 'M6',
  drafts: 'M8',
  more: 'M0',
  settings: 'M0',
};

export function canOpenSection(role: Role, section: string): section is Section {
  const nav = navByRole[role];
  return [...nav.tabs, ...nav.more, ...(nav.sidebar ?? [])].some((i) => i.section === section);
}
