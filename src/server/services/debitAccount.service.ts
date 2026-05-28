import "server-only";
import { DebitAccount } from "@/models";
import {
  type ScopedContext,
  tenantFilter,
  tenantStamp,
} from "@/lib/auth/tenant-context";

export type DebitAccountInput = {
  bankName: string;
  accountHolder?: string | null;
  accountMasked: string;
  branch?: string | null;
  notes?: string | null;
};

export async function listDebitAccounts(ctx: ScopedContext) {
  return DebitAccount.find(tenantFilter(ctx))
    .sort({ lastUsedAt: -1, bankName: 1 })
    .lean();
}

/**
 * Upsert by (tenantId, bankName, accountMasked). Updates `lastUsedAt` so the
 * dropdown can show "recently used" first. Returns the persisted row.
 */
export async function upsertDebitAccount(
  ctx: ScopedContext,
  input: DebitAccountInput,
) {
  const bankName = input.bankName.trim();
  const accountMasked = input.accountMasked.trim();
  if (!bankName || !accountMasked) return null;

  return DebitAccount.findOneAndUpdate(
    tenantFilter(ctx, { bankName, accountMasked }),
    {
      $set: {
        bankName,
        accountMasked,
        accountHolder: input.accountHolder?.trim() || null,
        branch: input.branch?.trim() || null,
        notes: input.notes?.trim() || null,
        lastUsedAt: new Date(),
        ...tenantStamp(ctx),
      },
    },
    { new: true, upsert: true },
  );
}
