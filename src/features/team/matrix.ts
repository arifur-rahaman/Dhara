/**
 * The role permission table on the Team page (docs/design/TeamRoles.dc.html), from plan.md section 3.1.
 * Display only: the rules themselves live in src/server/authz. `lock` marks fixed rules the owner cannot change.
 */
export type Cell = 'yes' | 'no' | 'lock' | 'all' | 'assigned' | 'today' | 'ordersOnly' | 'own';

export const matrixRows: { key: string; strong?: boolean; cells: [Cell, Cell, Cell, Cell] }[] = [
  { key: 'clientContact', strong: true, cells: ['yes', 'lock', 'lock', 'lock'] },
  { key: 'clientName', cells: ['yes', 'yes', 'yes', 'no'] },
  { key: 'cases', cells: ['all', 'assigned', 'all', 'today'] },
  { key: 'addHearing', cells: ['yes', 'yes', 'yes', 'no'] },
  { key: 'documents', cells: ['all', 'assigned', 'ordersOnly', 'no'] },
  { key: 'confidential', cells: ['yes', 'own', 'no', 'no'] },
  { key: 'messageClient', cells: ['yes', 'yes', 'no', 'no'] },
  { key: 'ai', cells: ['yes', 'yes', 'no', 'no'] },
  { key: 'fees', cells: ['yes', 'no', 'no', 'no'] },
  { key: 'tasks', cells: ['all', 'own', 'own', 'own'] },
  { key: 'team', strong: true, cells: ['yes', 'lock', 'lock', 'lock'] },
];
