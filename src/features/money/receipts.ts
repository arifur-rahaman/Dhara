import 'server-only';
import type { PaymentMethod } from '@/generated/prisma/client';
import type { Tx } from '@/server/db/client';

/**
 * Inserts a payment with the chamber's next receipt number (F10, TECH_GUIDE section 14).
 * The counter row is locked by the UPDATE until the transaction ends, so concurrent payments queue
 * and numbers stay sequential; a rolled-back payment also rolls back its number, leaving no gap.
 */
export async function insertPaymentWithReceipt(
  tx: Tx,
  p: {
    chamberId: string;
    caseId: string;
    clientId: string | null;
    amountPoisha: number;
    method: Exclude<PaymentMethod, 'gateway'>;
    reference: string | null;
    description: string;
    paidOn: Date;
    receivedBy: string;
  },
) {
  const [{ receipt_seq }] = await tx.$queryRaw<{ receipt_seq: number }[]>`
    UPDATE chambers SET receipt_seq = receipt_seq + 1, updated_at = now()
    WHERE id = ${p.chamberId}::uuid RETURNING receipt_seq`;
  const payment = await tx.payment.create({ data: { ...p, receiptNo: receipt_seq }, select: { id: true } });
  return { id: payment.id, receiptNo: receipt_seq };
}
