/**
 * Plan and account status values (SuperAdmin design). Prices are not decided yet (plan.md section 12, item 6),
 * so plans are labels only and payments are entered by hand.
 */
export const plans = ['trial', 'solo', 'chamber', 'organization'] as const;
export const chamberStatuses = ['active', 'past_due', 'suspended'] as const;
export type Plan = (typeof plans)[number];
export type ChamberStatus = (typeof chamberStatuses)[number];
