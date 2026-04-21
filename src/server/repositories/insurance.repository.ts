import "server-only";
import { InsurancePolicy, Vehicle } from "@/models";

type PolicyEnriched = Record<string, unknown> & {
  _id: unknown;
  vehicleId: unknown;
  vehicle?: unknown;
};

async function attachVehicle(
  policy: Record<string, unknown> & { _id: unknown; vehicleId: unknown },
): Promise<PolicyEnriched> {
  const vehicle = await Vehicle.findById(policy.vehicleId).lean();
  return { ...policy, vehicle };
}

async function attachVehicles(
  policies: Array<Record<string, unknown> & { _id: unknown; vehicleId: unknown }>,
): Promise<PolicyEnriched[]> {
  const vehicleIds = [...new Set(policies.map((p) => String(p.vehicleId)))];
  const vehicles = vehicleIds.length
    ? await Vehicle.find({ _id: { $in: vehicleIds } }).lean()
    : [];
  const vById = new Map(vehicles.map((v) => [String(v._id), v]));
  return policies.map((p) => ({
    ...p,
    vehicle: vById.get(String(p.vehicleId)) ?? null,
  }));
}

export type InsuranceListQuery = {
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
}: InsuranceListQuery = {}) {
  const skip = (page - 1) * Number(limit);
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;

  if (search) {
    const vehicles = await Vehicle.find({
      registrationNumber: { $regex: search, $options: "i" },
    })
      .select("_id")
      .lean();
    filter.$or = [
      { policyNumber: { $regex: search, $options: "i" } },
      { insurer: { $regex: search, $options: "i" } },
      { vehicleId: { $in: vehicles.map((v) => v._id) } },
    ];
  }

  const [raw, total] = await Promise.all([
    InsurancePolicy.find(filter)
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 })
      .lean(),
    InsurancePolicy.countDocuments(filter),
  ]);
  const policies = await attachVehicles(raw);
  return {
    policies,
    total,
    page: Number(page),
    totalPages: Math.ceil(total / Number(limit)),
  };
}

export async function findById(id: string) {
  const p = await InsurancePolicy.findById(id).lean();
  if (!p) return null;
  return attachVehicle(p);
}

export async function findByVehicleId(vehicleId: string) {
  const policies = await InsurancePolicy.find({ vehicleId })
    .sort({ createdAt: -1 })
    .lean();
  return attachVehicles(policies);
}

export async function findActiveByVehicleId(vehicleId: string) {
  const p = await InsurancePolicy.findOne({
    vehicleId,
    status: { $in: ["ACTIVE", "EXPIRING"] },
  }).lean();
  if (!p) return null;
  return attachVehicle(p);
}

export async function create(data: Record<string, unknown>) {
  const doc = await InsurancePolicy.create(data);
  return attachVehicle(doc.toObject() as Record<string, unknown> & {
    _id: unknown;
    vehicleId: unknown;
  });
}

export async function update(id: string, data: Record<string, unknown>) {
  const doc = await InsurancePolicy.findByIdAndUpdate(id, data, { new: true });
  if (!doc) return null;
  return attachVehicle(doc.toObject() as Record<string, unknown> & {
    _id: unknown;
    vehicleId: unknown;
  });
}

export async function getStats() {
  const [total, active, expiring, expired, premiumAgg] = await Promise.all([
    InsurancePolicy.countDocuments(),
    InsurancePolicy.countDocuments({ status: "ACTIVE" }),
    InsurancePolicy.countDocuments({ status: "EXPIRING" }),
    InsurancePolicy.countDocuments({ status: "EXPIRED" }),
    InsurancePolicy.aggregate([
      { $match: { status: { $in: ["ACTIVE", "EXPIRING"] } } },
      { $group: { _id: null, sum: { $sum: "$premium" } } },
    ]),
  ]);
  return {
    total,
    active,
    expiring,
    expired,
    totalPremium: premiumAgg[0]?.sum ?? 0,
  };
}

export async function findAllActive() {
  const policies = await InsurancePolicy.find({
    status: { $in: ["ACTIVE", "EXPIRING"] },
    expiryDate: { $ne: null },
  }).lean();
  return attachVehicles(policies);
}
