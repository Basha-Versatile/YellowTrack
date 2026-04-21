import "server-only";
import mongoose from "mongoose";
import { Challan, Payment, Vehicle } from "@/models";

export type CreatePaymentInput = {
  totalAmount: number;
  method: string;
  transactionId?: string | null;
  paidBy: string;
  challanIds: string[];
};

async function attachChallans(
  payment: Record<string, unknown> & { _id: unknown },
): Promise<Record<string, unknown>> {
  const challans = await Challan.find({ paymentId: payment._id }).lean();
  const vehicleIds = [...new Set(challans.map((c) => String(c.vehicleId)))];
  const vehicles = vehicleIds.length
    ? await Vehicle.find({ _id: { $in: vehicleIds } }).lean()
    : [];
  const vById = new Map(vehicles.map((v) => [String(v._id), v]));
  const enriched = challans.map((c) => ({
    ...c,
    vehicle: vById.get(String(c.vehicleId)) ?? null,
  }));
  return { ...payment, challans: enriched };
}

export async function create(input: CreatePaymentInput) {
  const payment = await Payment.create({
    totalAmount: input.totalAmount,
    method: input.method,
    transactionId: input.transactionId ?? undefined,
    paidBy: new mongoose.Types.ObjectId(input.paidBy),
    status: "SUCCESS",
  });

  await Challan.updateMany(
    { _id: { $in: input.challanIds.map((id) => new mongoose.Types.ObjectId(id)) } },
    { status: "PAID", paidAt: new Date(), paymentId: payment._id },
  );

  return attachChallans(payment.toObject() as Record<string, unknown> & { _id: unknown });
}

export async function findById(id: string) {
  const payment = await Payment.findById(id).lean();
  if (!payment) return null;
  return attachChallans(payment);
}

export async function findAll({
  page = 1,
  limit = 20,
}: { page?: number; limit?: number } = {}) {
  const skip = (page - 1) * limit;
  const [rawPayments, total] = await Promise.all([
    Payment.find().skip(skip).limit(limit).sort({ createdAt: -1 }).lean(),
    Payment.countDocuments(),
  ]);
  const payments = await Promise.all(
    rawPayments.map((p) => attachChallans(p)),
  );
  return { payments, total, page, totalPages: Math.ceil(total / limit) };
}
