import "server-only";
import mongoose from "mongoose";
import { Fastag, FastagTransaction, Vehicle } from "@/models";
import {
  type ScopedContext,
  tenantFilter,
  tenantStamp,
} from "@/lib/auth/tenant-context";

type FastagEnriched = Record<string, unknown> & {
  _id: unknown;
  vehicleId: unknown;
  vehicle?: unknown;
  transactions?: unknown[];
};

async function attachVehicle(
  ctx: ScopedContext,
  fastag: Record<string, unknown> & { _id: unknown; vehicleId: unknown },
): Promise<FastagEnriched> {
  const vehicle = await Vehicle.findOne(
    tenantFilter(ctx, { _id: fastag.vehicleId }),
  ).lean();
  return { ...fastag, vehicle };
}

async function attachTransactions(
  ctx: ScopedContext,
  fastag: FastagEnriched,
  limit: number,
): Promise<FastagEnriched> {
  const txs = await FastagTransaction.find(
    tenantFilter(ctx, { fastagId: fastag._id }),
  )
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  return { ...fastag, transactions: txs };
}

export async function findById(ctx: ScopedContext, id: string) {
  const fastag = await Fastag.findOne(tenantFilter(ctx, { _id: id })).lean();
  if (!fastag) return null;
  const withVehicle = await attachVehicle(ctx, fastag);
  return attachTransactions(ctx, withVehicle, 10);
}

export async function findByVehicleId(ctx: ScopedContext, vehicleId: string) {
  const fastags = await Fastag.find(tenantFilter(ctx, { vehicleId }))
    .sort({ createdAt: -1 })
    .lean();
  return Promise.all(
    fastags.map((f) =>
      attachTransactions(ctx, f as FastagEnriched, 5),
    ),
  );
}

export async function findActiveByVehicleId(
  ctx: ScopedContext,
  vehicleId: string,
) {
  const fastag = await Fastag.findOne(
    tenantFilter(ctx, { vehicleId, isActive: true }),
  ).lean();
  if (!fastag) return null;
  const withVehicle = await attachVehicle(ctx, fastag);
  return attachTransactions(ctx, withVehicle, 10);
}

export async function findByTagId(ctx: ScopedContext, tagId: string) {
  return Fastag.findOne(tenantFilter(ctx, { tagId })).lean();
}

export type FastagListQuery = {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
};

export async function findAll(
  ctx: ScopedContext,
  {
    page = 1,
    limit = 20,
    status,
    search,
  }: FastagListQuery = {},
) {
  const skip = (page - 1) * limit;
  const extras: Record<string, unknown> = {};
  if (status) extras.status = status;

  if (search) {
    const vehicles = await Vehicle.find(
      tenantFilter(ctx, {
        registrationNumber: { $regex: search, $options: "i" },
      }),
    )
      .select("_id")
      .lean();
    extras.$or = [
      { tagId: { $regex: search, $options: "i" } },
      { vehicleId: { $in: vehicles.map((v) => v._id) } },
    ];
  }

  const filter = tenantFilter(ctx, extras);
  const [fastags, total] = await Promise.all([
    Fastag.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }).lean(),
    Fastag.countDocuments(filter),
  ]);

  const enriched = await Promise.all(
    fastags.map((f) =>
      attachVehicle(
        ctx,
        f as Record<string, unknown> & { _id: unknown; vehicleId: unknown },
      ),
    ),
  );
  return {
    fastags: enriched,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function create(
  ctx: ScopedContext,
  data: Record<string, unknown>,
) {
  const doc = await Fastag.create({ ...data, ...tenantStamp(ctx) });
  return attachVehicle(
    ctx,
    doc.toObject() as Record<string, unknown> & { _id: unknown; vehicleId: unknown },
  );
}

export async function update(
  ctx: ScopedContext,
  id: string,
  data: Record<string, unknown>,
) {
  return Fastag.findOneAndUpdate(tenantFilter(ctx, { _id: id }), data, {
    new: true,
  });
}

export async function deactivateByVehicleId(
  ctx: ScopedContext,
  vehicleId: string,
) {
  return Fastag.updateMany(
    tenantFilter(ctx, { vehicleId, isActive: true }),
    { isActive: false, status: "INACTIVE" },
  );
}

export async function createTransaction(
  ctx: ScopedContext,
  data: Record<string, unknown>,
) {
  return FastagTransaction.create({ ...data, ...tenantStamp(ctx) });
}

export async function getTransactions(
  ctx: ScopedContext,
  fastagId: string,
  { page = 1, limit = 20 }: { page?: number; limit?: number } = {},
) {
  const skip = (page - 1) * limit;
  const [transactions, total] = await Promise.all([
    FastagTransaction.find(tenantFilter(ctx, { fastagId }))
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean(),
    FastagTransaction.countDocuments(tenantFilter(ctx, { fastagId })),
  ]);
  return { transactions, total, page, totalPages: Math.ceil(total / limit) };
}

export async function getStats(ctx: ScopedContext) {
  const [total, active, balanceAgg, lowBalance] = await Promise.all([
    Fastag.countDocuments(tenantFilter(ctx)),
    Fastag.countDocuments(tenantFilter(ctx, { isActive: true })),
    Fastag.aggregate([
      { $match: tenantFilter(ctx, { isActive: true }) },
      { $group: { _id: null, sum: { $sum: "$balance" } } },
    ]),
    Fastag.countDocuments(
      tenantFilter(ctx, { isActive: true, balance: { $lt: 100 } }),
    ),
  ]);
  return {
    total,
    active,
    totalBalance: balanceAgg[0]?.sum ?? 0,
    lowBalance,
  };
}

export async function findAllActive(ctx: ScopedContext) {
  const fastags = await Fastag.find(
    tenantFilter(ctx, { isActive: true, balance: { $gt: 0 } }),
  ).lean();
  return Promise.all(
    fastags.map((f) =>
      attachVehicle(
        ctx,
        f as Record<string, unknown> & { _id: unknown; vehicleId: unknown },
      ),
    ),
  );
}

export async function atomicRecharge(
  ctx: ScopedContext,
  fastagId: string,
  amount: number,
): Promise<number> {
  const fastag = await Fastag.findOne(tenantFilter(ctx, { _id: fastagId }));
  if (!fastag) throw new Error("FASTag not found");
  const newBalance = (fastag.balance ?? 0) + amount;
  fastag.balance = newBalance;
  await fastag.save();
  await FastagTransaction.create({
    ...tenantStamp(ctx),
    fastagId: new mongoose.Types.ObjectId(fastagId),
    type: "RECHARGE",
    amount,
    balance: newBalance,
    description: `Recharge of ₹${amount}`,
  });
  return newBalance;
}

export async function atomicToll(
  ctx: ScopedContext,
  fastagId: string,
  amount: number,
  tollPlaza: string,
): Promise<number> {
  const fastag = await Fastag.findOne(tenantFilter(ctx, { _id: fastagId }));
  if (!fastag) throw new Error("FASTag not found");
  const newBalance = (fastag.balance ?? 0) - amount;
  fastag.balance = newBalance;
  await fastag.save();
  await FastagTransaction.create({
    ...tenantStamp(ctx),
    fastagId: new mongoose.Types.ObjectId(fastagId),
    type: "TOLL",
    amount,
    balance: newBalance,
    description: `Toll - ${tollPlaza}`,
    tollPlaza,
  });
  return newBalance;
}
