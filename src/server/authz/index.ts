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
  /** Case list and detail screens (P3). Staff get only today's list. */
  listCases: (c: Ctx) => c.role !== 'staff',
  /** AddCase design: owner and associate add cases. */
  createCase: (c: Ctx) => isOwner(c) || c.role === 'associate',
  /** Deleting is owner-only and audited. */
  deleteCase: (c: Ctx) => isOwner(c),
  /** Only the owner reassigns cases (assignment is a permission decision). */
  assignCase: (c: Ctx) => isOwner(c),
  /** Clients list: names only (P2). Staff never. */
  listClients: (c: Ctx) => c.role !== 'staff',
  /** New clients by name; contact details stay owner-only (P1). */
  createClient: (c: Ctx) => isOwner(c) || c.role === 'associate',
  editClientContact: (c: Ctx) => isOwner(c),
  /** P4 */
  addHearing: (c: Ctx, k: CaseRef) => c.role !== 'staff' && can.viewCase(c, k),
  /** P7 */
  messageClient: (c: Ctx, k: CaseRef) => isOwner(c) || (c.role === 'associate' && can.viewCase(c, k)),
  /** P5 — the database applies the same rule per document (and P6 for private ones). */
  viewDocuments: (c: Ctx, k: CaseRef) => c.role !== 'staff' && can.viewCase(c, k),
  /** Munshi add orders only (order photos, P4/P5); owner and associates any kind on cases they can see. */
  uploadDocument: (c: Ctx, k: CaseRef, kind: 'order' | 'pleading' | 'other') =>
    can.viewDocuments(c, k) && (c.role !== 'munshi' || kind === 'order'),
  /** Only the owner or the uploader removes a document. */
  removeDocument: (c: Ctx, d: { uploadedBy: string }) => isOwner(c) || d.uploadedBy === c.userId,
  /** F9–F12: fees and payments are written by the owner; P9 decides who reads them. */
  recordMoney: (c: Ctx) => isOwner(c),
  /** F12: the reminder opens the owner's own SMS app with the client's number, so owner only (P1). */
  remindClient: (c: Ctx) => isOwner(c),
  /** F23 */
  viewReports: (c: Ctx) => isOwner(c),
  /** P8 */
  useAi: (c: Ctx) => isOwner(c) || c.role === 'associate',
  /** P9 — the owner may enable fees per associate. */
  viewFees: (c: Ctx) => isOwner(c) || (c.role === 'associate' && c.canSeeFees),
  /** P10 — fixed. */
  manageTeam: (c: Ctx) => isOwner(c),
  inviteMember: (c: Ctx) => isOwner(c),
  /** P11 — the owner assigns tasks and sees all; everyone else sees and ticks off their own. */
  assignTask: (c: Ctx) => isOwner(c),
  viewAllTasks: (c: Ctx) => isOwner(c),
  completeTask: (c: Ctx, t: { assigneeMembershipId: string }) =>
    isOwner(c) || t.assigneeMembershipId === c.membershipId,
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
