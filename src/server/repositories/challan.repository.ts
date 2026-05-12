import "server-only";
import mongoose from "mongoose";
import { Challan, Payment, Vehicle } from "@/models";
import {
  type ScopedContext,
  tenantFilter,
} from "@/lib/auth/tenant-context";

export type ChallanListQuery = {
  page?: number;
  limit?: number;
  status?: string;
  vehicleId?: string;
  search?: string;
};

export async function findById(ctx: ScopedContext, id: string) {
  const challan = await Challan.findOne(tenantFilter(ctx, { _id: id })).lean();
  if (!challan) return null;
  const [vehicle, payment] = await Promise.all([
    Vehicle.findOne(tenantFilter(ctx, { _id: challan.vehicleId })).lean(),
    challan.paymentId
      ? Payment.findOne(tenantFilter(ctx, { _id: challan.paymentId })).lean()
      : null,
  ]);
  return { ...challan, vehicle, payment };
}

export async function findByVehicleId(ctx: ScopedContext, vehicleId: string) {
  const challans = await Challan.find(tenantFilter(ctx, { vehicleId }))
    .sort({ issuedAt: -1 })
    .lean();
  const paymentIds = challans
    .map((c) => c.paymentId)
    .filter((id): id is mongoose.Types.ObjectId => Boolean(id));
  const payments = paymentIds.length
    ? await Payment.find(tenantFilter(ctx, { _id: { $in: paymentIds } })).lean()
    : [];
  const byId = new Map(payments.map((p) => [String(p._id), p]));
  return challans.map((c) => ({
    ...c,
    payment: c.paymentId ? byId.get(String(c.paymentId)) ?? null : null,
  }));
}

export async function findAll(
  ctx: ScopedContext,
  {
    page = 1,
    limit = 20,
    status,
    vehicleId,
    search,
  }: ChallanListQuery = {},
) {
  const skip = (page - 1) * limit;
  const extras: Record<string, unknown> = {};
  if (status) extras.status = status;
  if (vehicleId) extras.vehicleId = vehicleId;

  if (search) {
    const vehicles = await Vehicle.find(
      tenantFilter(ctx, {
        registrationNumber: { $regex: search, $options: "i" },
      }),
    )
      .select("_id")
      .lean();
    extras.vehicleId = { $in: vehicles.map((v) => v._id) };
  }

  const filter = tenantFilter(ctx, extras);

  const [challans, total] = await Promise.all([
    Challan.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ issuedAt: -1 })
      .lean(),
    Challan.countDocuments(filter),
  ]);

  const vehicleIds = [...new Set(challans.map((c) => String(c.vehicleId)))];
  const paymentIds = challans
    .map((c) => c.paymentId)
    .filter((id): id is mongoose.Types.ObjectId => Boolean(id));
  const [vehicles, payments] = await Promise.all([
    vehicleIds.length
      ? Vehicle.find(tenantFilter(ctx, { _id: { $in: vehicleIds } })).lean()
      : [],
    paymentIds.length
      ? Payment.find(tenantFilter(ctx, { _id: { $in: paymentIds } })).lean()
      : [],
  ]);
  const vByIdMap = new Map(vehicles.map((v) => [String(v._id), v]));
  const pByIdMap = new Map(payments.map((p) => [String(p._id), p]));

  const enriched = challans.map((c) => ({
    ...c,
    vehicle: vByIdMap.get(String(c.vehicleId)) ?? null,
    payment: c.paymentId ? pByIdMap.get(String(c.paymentId)) ?? null : null,
  }));

  return {
    challans: enriched,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function createMany(docs: Array<Record<string, unknown>>) {
  if (docs.length === 0) return [];
  return Challan.insertMany(
    docs.map((d) => ({
      ...d,
      vehicleId:
        typeof d.vehicleId === "string"
          ? new mongoose.Types.ObjectId(d.vehicleId as string)
          : d.vehicleId,
    })),
  );
}

export async function getPendingSummary(
  ctx: ScopedContext,
  vehicleId?: string,
) {
  const extras: Record<string, unknown> = { status: "PENDING" };
  if (vehicleId) extras.vehicleId = new mongoose.Types.ObjectId(vehicleId);
  const agg = await Challan.aggregate([
    { $match: tenantFilter(ctx, extras) },
    { $group: { _id: null, sum: { $sum: "$amount" }, count: { $sum: 1 } } },
  ]);
  const row = agg[0] ?? { count: 0, sum: 0 };
  return { pendingCount: row.count, pendingAmount: row.sum ?? 0 };
}

export async function getStats(ctx: ScopedContext) {
  const [pending, paid, total] = await Promise.all([
    Challan.aggregate([
      { $match: tenantFilter(ctx, { status: "PENDING" }) },
      { $group: { _id: null, sum: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    Challan.aggregate([
      { $match: tenantFilter(ctx, { status: "PAID" }) },
      { $group: { _id: null, sum: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    Challan.countDocuments(tenantFilter(ctx)),
  ]);
  return {
    total,
    pending: {
      count: pending[0]?.count ?? 0,
      amount: pending[0]?.sum ?? 0,
    },
    paid: {
      count: paid[0]?.count ?? 0,
      amount: paid[0]?.sum ?? 0,
    },
  };
}
