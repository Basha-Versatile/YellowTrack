import "server-only";
import mongoose from "mongoose";
import { CreditCard, CreditCardBillHistory } from "@/models";
import {
  type ScopedContext,
  tenantFilter,
  tenantStamp,
} from "@/lib/auth/tenant-context";

/** All non-deleted cards for the tenant. Sorting by due date is done in the
 *  service layer (it depends on "today"), so we just return the raw rows. */
export async function findAllActive(ctx: ScopedContext) {
  return CreditCard.find(tenantFilter(ctx, { isActive: true }))
    .sort({ createdAt: -1 })
    .lean();
}

export async function findById(ctx: ScopedContext, id: string) {
  return CreditCard.findOne(tenantFilter(ctx, { _id: id, isActive: true })).lean();
}

export async function create(
  ctx: ScopedContext,
  data: Record<string, unknown>,
) {
  return CreditCard.create({ ...data, ...tenantStamp(ctx) });
}

export async function update(
  ctx: ScopedContext,
  id: string,
  data: Record<string, unknown>,
) {
  return CreditCard.findOneAndUpdate(
    tenantFilter(ctx, { _id: id, isActive: true }),
    data,
    { new: true },
  ).lean();
}

/** Soft-delete — keeps the card row so its bill history stays attributable. */
export async function softDelete(ctx: ScopedContext, id: string) {
  return CreditCard.findOneAndUpdate(
    tenantFilter(ctx, { _id: id, isActive: true }),
    { isActive: false },
    { new: true },
  ).lean();
}

export async function appendBillHistory(
  ctx: ScopedContext,
  data: { cardId: string; billMonth: string; amount: number; paidAt: Date },
) {
  return CreditCardBillHistory.create({
    ...tenantStamp(ctx),
    cardId: new mongoose.Types.ObjectId(data.cardId),
    billMonth: data.billMonth,
    amount: data.amount,
    paidAt: data.paidAt,
  });
}

export async function listBillHistory(
  ctx: ScopedContext,
  cardId: string,
  limit = 12,
) {
  return CreditCardBillHistory.find(tenantFilter(ctx, { cardId }))
    .sort({ billMonth: -1 })
    .limit(limit)
    .lean();
}
