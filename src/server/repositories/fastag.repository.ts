import "server-only";
import mongoose from "mongoose";
import { Fastag, FastagTransaction, Vehicle } from "@/models";

type FastagEnriched = Record<string, unknown> & {
  _id: unknown;
  vehicleId: unknown;
  vehicle?: unknown;
  transactions?: unknown[];
};

async function attachVehicle(
  fastag: Record<string, unknown> & { _id: unknown; vehicleId: unknown },
): Promise<FastagEnriched> {
  const vehicle = await Vehicle.findById(fastag.vehicleId).lean();
  return { ...fastag, vehicle };
}

async function attachTransactions(
  fastag: FastagEnriched,
  limit: number,
): Promise<FastagEnriched> {
  const txs = await FastagTransaction.find({ fastagId: fastag._id })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  return { ...fastag, transactions: txs };
}

export async function findById(id: string) {
  const fastag = await Fastag.findById(id).lean();
  if (!fastag) return null;
  const withVehicle = await attachVehicle(fastag);
  return attachTransactions(withVehicle, 10);
}

export async function findByVehicleId(vehicleId: string) {
  const fastags = await Fastag.find({ vehicleId })
    .sort({ createdAt: -1 })
    .lean();
  return Promise.all(
    fastags.map((f) =>
      attachTransactions(f as FastagEnriched, 5),
    ),
  );
}

export async function findActiveByVehicleId(vehicleId: string) {
  const fastag = await Fastag.findOne({ vehicleId, isActive: true }).lean();
  if (!fastag) return null;
  const withVehicle = await attachVehicle(fastag);
  return attachTransactions(withVehicle, 10);
}

export async function findByTagId(tagId: string) {
  return Fastag.findOne({ tagId }).lean();
}

export type FastagListQuery = {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
};

export async function findAll({
  page = 1,
  limit = 20,
  status,
  search,
}: FastagListQuery = {}) {
  const skip = (page - 1) * limit;
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;

  if (search) {
    const vehicles = await Vehicle.find({
      registrationNumber: { $regex: search, $options: "i" },
    })
      .select("_id")
      .lean();
    filter.$or = [
      { tagId: { $regex: search, $options: "i" } },
      { vehicleId: { $in: vehicles.map((v) => v._id) } },
    ];
  }

  const [fastags, total] = await Promise.all([
    Fastag.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }).lean(),
    Fastag.countDocuments(filter),
  ]);

  const enriched = await Promise.all(
    fastags.map((f) =>
      attachVehicle(f as Record<string, unknown> & { _id: unknown; vehicleId: unknown }),
    ),
  );
  return {
    fastags: enriched,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function create(data: Record<string, unknown>) {
  const doc = await Fastag.create(data);
  return attachVehicle(doc.toObject() as Record<string, unknown> & { _id: unknown; vehicleId: unknown });
}

export async function update(id: string, data: Record<string, unknown>) {
  return Fastag.findByIdAndUpdate(id, data, { new: true });
}

export async function deactivateByVehicleId(vehicleId: string) {
  return Fastag.updateMany(
    { vehicleId, isActive: true },
    { isActive: false, status: "INACTIVE" },
  );
}

export async function createTransaction(data: Record<string, unknown>) {
  return FastagTransaction.create(data);
}

export async function getTransactions(
  fastagId: string,
  { page = 1, limit = 20 }: { page?: number; limit?: number } = {},
) {
  const skip = (page - 1) * limit;
  const [transactions, total] = await Promise.all([
    FastagTransaction.find({ fastagId })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean(),
    FastagTransaction.countDocuments({ fastagId }),
  ]);
  return { transactions, total, page, totalPages: Math.ceil(total / limit) };
}

export async function getStats() {
  const [total, active, balanceAgg, lowBalance] = await Promise.all([
    Fastag.countDocuments(),
    Fastag.countDocuments({ isActive: true }),
    Fastag.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: null, sum: { $sum: "$balance" } } },
    ]),
    Fastag.countDocuments({ isActive: true, balance: { $lt: 100 } }),
  ]);
  return {
    total,
    active,
    totalBalance: balanceAgg[0]?.sum ?? 0,
    lowBalance,
  };
}

export async function findAllActive() {
  const fastags = await Fastag.find({
    isActive: true,
    balance: { $gt: 0 },
  }).lean();
  return Promise.all(
    fastags.map((f) =>
      attachVehicle(
        f as Record<string, unknown> & { _id: unknown; vehicleId: unknown },
      ),
    ),
  );
}

export async function atomicRecharge(
  fastagId: string,
  amount: number,
): Promise<number> {
  const fastag = await Fastag.findById(fastagId);
  if (!fastag) throw new Error("FASTag not found");
  const newBalance = (fastag.balance ?? 0) + amount;
  fastag.balance = newBalance;
  await fastag.save();
  await FastagTransaction.create({
    fastagId: new mongoose.Types.ObjectId(fastagId),
    type: "RECHARGE",
    amount,
    balance: newBalance,
    description: `Recharge of ₹${amount}`,
  });
  return newBalance;
}

export async function atomicToll(
  fastagId: string,
  amount: number,
  tollPlaza: string,
): Promise<number> {
  const fastag = await Fastag.findById(fastagId);
  if (!fastag) throw new Error("FASTag not found");
  const newBalance = (fastag.balance ?? 0) - amount;
  fastag.balance = newBalance;
  await fastag.save();
  await FastagTransaction.create({
    fastagId: new mongoose.Types.ObjectId(fastagId),
    type: "TOLL",
    amount,
    balance: newBalance,
    description: `Toll - ${tollPlaza}`,
    tollPlaza,
  });
  return newBalance;
}
