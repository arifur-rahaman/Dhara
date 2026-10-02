import type { IconName } from '@/components/icons';

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
  | 'photo'
  | 'calendar'
  | 'tasks'
  | 'documents'
  | 'team'
  | 'reports'
  | 'courses'
  | 'notifications'
  | 'settings';

export type NavItem = { section: Section; href: `/${string}`; icon: IconName };

const item = (section: Section, icon: IconName = section as IconName): NavItem => ({
  section,
  href: `/${section}`,
  icon,
});

const today = item('today');
const cases = item('cases');
const clients = item('clients');
const accounts = item('accounts');
const more = item('more');
const drafts = item('drafts');
const photo = item('photo');
const calendar = item('calendar');
const tasks = item('tasks');
const documents = item('documents');
const team = item('team');
const reports = item('reports');
const courses = item('courses');
const notifications = item('notifications');
const settings = item('settings');

/**
 * Navigation per role, from docs/design:
 * tabs — OwnerToday, AssociateClient, MunshiToday, StaffToday; owner web sidebar — TeamRoles, Reports.
 * The "More" lists are not in the designs; they collect the remaining screens each role may open (plan.md 3.1).
 *
 * Navigation is cosmetic: the server decides access (src/server/authz, from M1).
 */
export const navByRole: Record<Role, { tabs: NavItem[]; more: NavItem[]; sidebar: NavItem[] | null }> = {
  owner: {
    tabs: [today, cases, clients, accounts, more],
    more: [notifications, calendar, tasks, documents, drafts, team, reports, courses, settings],
    sidebar: [today, cases, clients, accounts, reports, team, settings],
  },
  associate: {
    tabs: [today, cases, clients, drafts, more],
    more: [notifications, calendar, tasks, documents, courses, settings],
    sidebar: null,
  },
  munshi: {
    tabs: [today, cases, photo, more],
    more: [notifications, calendar, tasks, documents, courses, settings],
    sidebar: null,
  },
  staff: {
    tabs: [today, tasks, more],
    more: [notifications, courses, settings],
    sidebar: null,
  },
};

/** Milestone (plan.md section 9) that builds each placeholder screen. */
export const sectionMilestone: Record<Section, string> = {
  today: 'M2',
  cases: 'M2',
  clients: 'M2',
  calendar: 'M2',
  photo: 'M4',
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
