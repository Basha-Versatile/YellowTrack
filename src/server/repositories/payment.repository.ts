import "server-only";
import mongoose from "mongoose";
import { Challan, Payment, Vehicle } from "@/models";
import {
  type ScopedContext,
  tenantFilter,
  tenantStamp,
} from "@/lib/auth/tenant-context";

export type CreatePaymentInput = {
  totalAmount: number;
  method: string;
  transactionId?: string | null;
  paidBy: string;
  challanIds: string[];
};

async function attachChallans(
  ctx: ScopedContext,
  payment: Record<string, unknown> & { _id: unknown },
): Promise<Record<string, unknown>> {
  const challans = await Challan.find(
    tenantFilter(ctx, { paymentId: payment._id }),
  ).lean();
  const vehicleIds = [...new Set(challans.map((c) => String(c.vehicleId)))];
  const vehicles = vehicleIds.length
    ? await Vehicle.find(tenantFilter(ctx, { _id: { $in: vehicleIds } })).lean()
    : [];
  const vById = new Map(vehicles.map((v) => [String(v._id), v]));
  const enriched = challans.map((c) => ({
    ...c,
    vehicle: vById.get(String(c.vehicleId)) ?? null,
  }));
  return { ...payment, challans: enriched };
}

export async function create(ctx: ScopedContext, input: CreatePaymentInput) {
  const payment = await Payment.create({
    ...tenantStamp(ctx),
    totalAmount: input.totalAmount,
    method: input.method,
    transactionId: input.transactionId ?? undefined,
    paidBy: new mongoose.Types.ObjectId(input.paidBy),
    status: "SUCCESS",
  });

  await Challan.updateMany(
    tenantFilter(ctx, {
      _id: { $in: input.challanIds.map((id) => new mongoose.Types.ObjectId(id)) },
    }),
    { status: "PAID", paidAt: new Date(), paymentId: payment._id },
  );

  return attachChallans(
    ctx,
    payment.toObject() as Record<string, unknown> & { _id: unknown },
  );
}

export async function findById(ctx: ScopedContext, id: string) {
  const payment = await Payment.findOne(tenantFilter(ctx, { _id: id })).lean();
  if (!payment) return null;
  return attachChallans(ctx, payment);
}

export async function findAll(
  ctx: ScopedContext,
  {
    page = 1,
    limit = 20,
  }: { page?: number; limit?: number } = {},
) {
  const skip = (page - 1) * limit;
  const [rawPayments, total] = await Promise.all([
    Payment.find(tenantFilter(ctx))
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean(),
    Payment.countDocuments(tenantFilter(ctx)),
  ]);
  const payments = await Promise.all(
    rawPayments.map((p) => attachChallans(ctx, p)),
  );
  return { payments, total, page, totalPages: Math.ceil(total / limit) };
}
