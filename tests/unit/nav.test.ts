import { describe, expect, it } from 'vitest';
import { canOpenSection, navByRole, roles } from '@/features/shell/nav';

describe('role navigation (plan.md M0)', () => {
  it('has 5 owner, 5 associate, 4 munshi and 3 staff tabs', () => {
    expect(navByRole.owner.tabs).toHaveLength(5);
    expect(navByRole.associate.tabs).toHaveLength(5);
    expect(navByRole.munshi.tabs).toHaveLength(4);
    expect(navByRole.staff.tabs).toHaveLength(3);
  });

  it('matches the tab bars in docs/design', () => {
    const tabs = (role: keyof typeof navByRole) => navByRole[role].tabs.map((i) => i.section);
    expect(tabs('owner')).toEqual(['today', 'cases', 'clients', 'accounts', 'more']); // OwnerToday
    expect(tabs('associate')).toEqual(['today', 'cases', 'clients', 'drafts', 'more']); // AssociateClient
    expect(tabs('munshi')).toEqual(['today', 'cases', 'photo', 'more']); // MunshiToday
    expect(tabs('staff')).toEqual(['today', 'tasks', 'more']); // StaffToday
  });

  it('matches the owner web sidebar in docs/design (TeamRoles, Reports)', () => {
    expect(navByRole.owner.sidebar?.map((i) => i.section)).toEqual([
      'today',
      'cases',
      'clients',
      'accounts',
      'reports',
      'team',
      'settings',
    ]);
  });

  it('shows the web sidebar to the owner only', () => {
    expect(navByRole.owner.sidebar).not.toBeNull();
    for (const role of roles.filter((r) => r !== 'owner')) expect(navByRole[role].sidebar).toBeNull();
  });

  it('never links non-owners to team, accounts or reports (P9, P10)', () => {
    for (const role of roles.filter((r) => r !== 'owner')) {
      for (const section of ['team', 'accounts', 'reports']) expect(canOpenSection(role, section)).toBe(false);
    }
  });

  it('never links staff to clients or cases (P2, P3)', () => {
    expect(canOpenSection('staff', 'clients')).toBe(false);
    expect(canOpenSection('staff', 'cases')).toBe(false);
  });

  it('gives every role Today, More and Settings', () => {
    for (const role of roles) {
      for (const section of ['today', 'more', 'settings']) expect(canOpenSection(role, section)).toBe(true);
    }
  });
});
