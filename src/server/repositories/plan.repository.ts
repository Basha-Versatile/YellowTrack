import "server-only";
import { Plan, Tenant } from "@/models";

export async function findAll(opts: { includeInactive?: boolean } = {}) {
  const filter = opts.includeInactive ? {} : { isActive: true };
  const plans = await Plan.find(filter).sort({ price: 1, name: 1 }).lean();
  if (plans.length === 0) return [];

  // Enrich with subscriber counts (active subscriptions per plan).
  const counts = await Tenant.aggregate([
    {
      $match: {
        planId: { $in: plans.map((p) => p._id) },
        status: { $ne: "DELETED" },
      },
    },
    { $group: { _id: "$planId", count: { $sum: 1 } } },
  ]);
  const countMap = new Map<string, number>(
    counts.map((c) => [String(c._id), c.count as number]),
  );

  return plans.map((p) => ({
    ...p,
    tenantCount: countMap.get(String(p._id)) ?? 0,
  }));
}

export async function findActive() {
  // Sort by fleet-size band so the cheapest entry tier shows first.
  return Plan.find({ isActive: true })
    .sort({ fleetSizeMin: 1, perVehiclePerMonth: -1 })
    .lean();
}

export async function findById(id: string) {
  return Plan.findById(id).lean();
}

export async function findByName(name: string) {
  return Plan.findOne({ name }).lean();
}

export async function create(data: Record<string, unknown>) {
  return Plan.create(data);
}

export async function update(id: string, data: Record<string, unknown>) {
  return Plan.findByIdAndUpdate(id, data, { new: true });
}

export async function countTenantsOnPlan(id: string) {
  return Tenant.countDocuments({
    planId: id,
    status: { $ne: "DELETED" },
  });
}
