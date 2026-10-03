import 'server-only';

/**
 * All permission decisions (CLAUDE.md rule 4, plan.md section 3.1). One function per resource and action.
 * UI hiding is cosmetic; server code calls these before every read and write.
 */
export type Role = 'owner' | 'associate' | 'munshi' | 'staff';

export type Ctx = {
  userId: string;
  chamberId: string;
  membershipId: string;
  role: Role;
  caseScope: 'all' | 'assigned';
  canSeeFees: boolean;
};

type CaseRef = { assigneeMembershipId: string | null };

const isOwner = (c: Ctx) => c.role === 'owner';

export const can = {
  /** P1 — fixed: client phone, email, NID, address. */
  viewClientContact: (c: Ctx) => isOwner(c),
  /** P2 */
  viewClientName: (c: Ctx) => c.role !== 'staff',
  /** P3 — staff see only today's list (case number, court, serial) through a separate query. */
  viewCase: (c: Ctx, k: CaseRef) =>
    isOwner(c) ||
    c.role === 'munshi' ||
    (c.role === 'associate' && (c.caseScope === 'all' || k.assigneeMembershipId === c.membershipId)),
  /** P4 */
  addHearing: (c: Ctx, k: CaseRef) => c.role !== 'staff' && can.viewCase(c, k),
  /** P7 */
  messageClient: (c: Ctx, k: CaseRef) => isOwner(c) || (c.role === 'associate' && can.viewCase(c, k)),
  /** P8 */
  useAi: (c: Ctx) => isOwner(c) || c.role === 'associate',
  /** P9 — the owner may enable fees per associate. */
  viewFees: (c: Ctx) => isOwner(c) || (c.role === 'associate' && c.canSeeFees),
  /** P10 — fixed. */
  manageTeam: (c: Ctx) => isOwner(c),
  inviteMember: (c: Ctx) => isOwner(c),
  /** P12 */
  editChamberSettings: (c: Ctx) => isOwner(c),
  /** P13 — fixed. */
  approveSupportAccess: (c: Ctx) => isOwner(c),
  /** P14 */
  exportData: (c: Ctx) => isOwner(c),
  /** Audit log is the owner's (plan.md principle 3). */
  viewAuditLog: (c: Ctx) => isOwner(c),
} as const;

export class ForbiddenError extends Error {
  constructor(public readonly permission: keyof typeof can) {
    super(`Forbidden: ${permission}`);
    this.name = 'ForbiddenError';
  }
}

/** Throws unless the permission holds. Use at the top of every server action. */
export function assertCan<K extends keyof typeof can>(permission: K, ...args: Parameters<(typeof can)[K]>): void {
  const check = can[permission] as (...a: Parameters<(typeof can)[K]>) => boolean;
  if (!check(...args)) throw new ForbiddenError(permission);
}
