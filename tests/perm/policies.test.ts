import { describe, expect, it } from 'vitest';
import { can, type Ctx, type Role } from '@/server/authz';

const ctx = (role: Role, extra: Partial<Ctx> = {}): Ctx => ({
  userId: `u-${role}`,
  chamberId: 'c1',
  membershipId: `m-${role}`,
  role,
  caseScope: 'assigned',
  canSeeFees: false,
  ...extra,
});
const roles: Role[] = ['owner', 'associate', 'munshi', 'staff'];
const mine = { assigneeMembershipId: 'm-associate' };
const other = { assigneeMembershipId: 'm-someone-else' };

function expectOnly(check: (c: Ctx) => boolean, allowed: Role[]) {
  for (const role of roles) expect(check(ctx(role)), role).toBe(allowed.includes(role));
}

describe('P1 client contact is owner-only (fixed)', () => {
  it('only the owner', () => expectOnly(can.viewClientContact, ['owner']));
  it('stays owner-only whatever an associate is granted', () => {
    expect(can.viewClientContact(ctx('associate', { caseScope: 'all', canSeeFees: true }))).toBe(false);
  });
});

describe('P2 client name', () => {
  it('everyone except staff', () => expectOnly(can.viewClientName, ['owner', 'associate', 'munshi']));
});

describe('P3 cases and dates', () => {
  it('owner and munshi see every case', () => {
    expect(can.viewCase(ctx('owner'), other)).toBe(true);
    expect(can.viewCase(ctx('munshi'), other)).toBe(true);
  });
  it('associate sees assigned cases only, unless the owner allows all', () => {
    expect(can.viewCase(ctx('associate'), mine)).toBe(true);
    expect(can.viewCase(ctx('associate'), other)).toBe(false);
    expect(can.viewCase(ctx('associate', { caseScope: 'all' }), other)).toBe(true);
  });
  it('staff never open a case record', () => expect(can.viewCase(ctx('staff'), mine)).toBe(false));
});

describe('P4 add next date and order photo', () => {
  it('owner, munshi, and associate on assigned cases', () => {
    expect(can.addHearing(ctx('owner'), other)).toBe(true);
    expect(can.addHearing(ctx('munshi'), other)).toBe(true);
    expect(can.addHearing(ctx('associate'), mine)).toBe(true);
    expect(can.addHearing(ctx('associate'), other)).toBe(false);
    expect(can.addHearing(ctx('staff'), mine)).toBe(false);
  });
});

describe('P7 message a client without seeing the number', () => {
  it('owner, and associate on assigned cases only', () => {
    expect(can.messageClient(ctx('owner'), other)).toBe(true);
    expect(can.messageClient(ctx('associate'), mine)).toBe(true);
    expect(can.messageClient(ctx('associate'), other)).toBe(false);
    expect(can.messageClient(ctx('munshi'), mine)).toBe(false);
    expect(can.messageClient(ctx('staff'), mine)).toBe(false);
  });
});

describe('P8 AI tools', () => {
  it('owner and associate', () => expectOnly(can.useAi, ['owner', 'associate']));
});

describe('P9 fees', () => {
  it('owner only by default', () => expectOnly(can.viewFees, ['owner']));
  it('owner may enable fees per associate, never for munshi or staff', () => {
    expect(can.viewFees(ctx('associate', { canSeeFees: true }))).toBe(true);
    expect(can.viewFees(ctx('munshi', { canSeeFees: true }))).toBe(false);
    expect(can.viewFees(ctx('staff', { canSeeFees: true }))).toBe(false);
  });
});

describe('P10 team and permissions (fixed)', () => {
  it('only the owner manages the team', () => expectOnly(can.manageTeam, ['owner']));
  it('only the owner invites', () => expectOnly(can.inviteMember, ['owner']));
});

describe('P12–P14', () => {
  it('chamber settings, support approval and export are owner-only', () => {
    expectOnly(can.editChamberSettings, ['owner']);
    expectOnly(can.approveSupportAccess, ['owner']);
    expectOnly(can.exportData, ['owner']);
    expectOnly(can.viewAuditLog, ['owner']);
  });
});
