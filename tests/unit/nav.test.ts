import { describe, expect, it } from 'vitest';
import { canOpenSection, navByRole, roles } from '@/features/shell/nav';

describe('role navigation (plan.md M0)', () => {
  it('has 5 owner, 5 associate, 4 munshi and 3 staff tabs', () => {
    expect(navByRole.owner.tabs).toHaveLength(5);
    expect(navByRole.associate.tabs).toHaveLength(5);
    expect(navByRole.munshi.tabs).toHaveLength(4);
    expect(navByRole.staff.tabs).toHaveLength(3);
  });

  it('gives the owner Today, Cases, Clients, Accounts, More (CLAUDE.md)', () => {
    expect(navByRole.owner.tabs.map((i) => i.section)).toEqual(['today', 'cases', 'clients', 'accounts', 'more']);
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
