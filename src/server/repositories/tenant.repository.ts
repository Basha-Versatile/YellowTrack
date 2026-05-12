import "server-only";
import { Driver, Tenant, User, Vehicle } from "@/models";

export type TenantListQuery = {
  page?: number;
  limit?: number;
  search?: string;
  status?: "ACTIVE" | "SUSPENDED" | "DELETED";
  plan?: "FREE" | "PRO" | "ENTERPRISE";
};

export async function findAll({
  page = 1,
  limit = 20,
  search,
  status,
  plan,
}: TenantListQuery = {}) {
  const skip = (page - 1) * limit;
  const filter: Record<string, unknown> = {};

  if (status) filter.status = status;
  else filter.status = { $ne: "DELETED" };
  if (plan) filter.plan = plan;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { slug: { $regex: search, $options: "i" } },
      { billingEmail: { $regex: search, $options: "i" } },
    ];
  }

  const [tenants, total] = await Promise.all([
    Tenant.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean(),
    Tenant.countDocuments(filter),
  ]);

  // Enrich with user counts per tenant.
  const tenantIds = tenants.map((t) => t._id);
  const userCounts =
    tenantIds.length > 0
      ? await User.aggregate([
          { $match: { tenantId: { $in: tenantIds } } },
          { $group: { _id: "$tenantId", count: { $sum: 1 } } },
        ])
      : [];
  const userCountMap = new Map<string, number>(
    userCounts.map((u) => [String(u._id), u.count as number]),
  );

  const enriched = tenants.map((t) => ({
    ...t,
    userCount: userCountMap.get(String(t._id)) ?? 0,
  }));

  return {
    tenants: enriched,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function findById(id: string) {
  return Tenant.findById(id).lean();
}

export async function findBySlug(slug: string) {
  return Tenant.findOne({ slug: slug.toLowerCase() }).lean();
}

export async function create(data: Record<string, unknown>) {
  return Tenant.create(data);
}

export async function update(id: string, data: Record<string, unknown>) {
  return Tenant.findByIdAndUpdate(id, data, { new: true });
}

export async function suspend(id: string) {
  return Tenant.findByIdAndUpdate(
    id,
    { status: "SUSPENDED", suspendedAt: new Date() },
    { new: true },
  );
}

export async function resume(id: string) {
  return Tenant.findByIdAndUpdate(
    id,
    { status: "ACTIVE", suspendedAt: null },
    { new: true },
  );
}

export async function softDelete(id: string) {
  return Tenant.findByIdAndUpdate(
    id,
    { status: "DELETED", deletedAt: new Date() },
    { new: true },
  );
}

export async function getGlobalStats() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    tenantStats,
    userCount,
    suspendedCount,
    vehicleCount,
    driverCount,
    newTenants7d,
    newUsers7d,
    newVehicles7d,
    newDrivers7d,
    planAgg,
    statusAgg,
  ] = await Promise.all([
    Tenant.countDocuments({ status: { $ne: "DELETED" } }),
    User.countDocuments({ role: { $in: ["ADMIN", "OPERATOR"] } }),
    Tenant.countDocuments({ status: "SUSPENDED" }),
    Vehicle.countDocuments({}),
    Driver.countDocuments({}),
    Tenant.countDocuments({
      status: { $ne: "DELETED" },
      createdAt: { $gte: sevenDaysAgo },
    }),
    User.countDocuments({
      role: { $in: ["ADMIN", "OPERATOR"] },
      createdAt: { $gte: sevenDaysAgo },
    }),
    Vehicle.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
    Driver.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
    Tenant.aggregate([
      { $match: { status: { $ne: "DELETED" } } },
      { $group: { _id: "$plan", count: { $sum: 1 } } },
    ]),
    Tenant.aggregate([
      { $match: { status: { $ne: "DELETED" } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);

  const planBuckets = { FREE: 0, PRO: 0, ENTERPRISE: 0 };
  for (const p of planAgg) {
    if (p._id && p._id in planBuckets) {
      planBuckets[p._id as keyof typeof planBuckets] = p.count as number;
    }
  }
  const statusBuckets = { ACTIVE: 0, SUSPENDED: 0, DELETED: 0 };
  for (const s of statusAgg) {
    if (s._id && s._id in statusBuckets) {
      statusBuckets[s._id as keyof typeof statusBuckets] = s.count as number;
    }
  }

  return {
    tenants: tenantStats,
    suspended: suspendedCount,
    users: userCount,
    vehicles: vehicleCount,
    drivers: driverCount,
    growth7d: {
      tenants: newTenants7d,
      users: newUsers7d,
      vehicles: newVehicles7d,
      drivers: newDrivers7d,
    },
    plans: planBuckets,
    statuses: statusBuckets,
  };
}

export async function getTopTenantsByFleet(limit = 5) {
  const top = await Vehicle.aggregate([
    { $group: { _id: "$tenantId", vehicles: { $sum: 1 } } },
    { $sort: { vehicles: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: "tenants",
        localField: "_id",
        foreignField: "_id",
        as: "tenant",
      },
    },
    { $unwind: "$tenant" },
    {
      $project: {
        _id: 0,
        tenantId: "$_id",
        name: "$tenant.name",
        slug: "$tenant.slug",
        plan: "$tenant.plan",
        status: "$tenant.status",
        vehicles: 1,
      },
    },
  ]);

  if (top.length === 0) return [];

  // Drivers per top-tenant — single roundtrip
  const tenantIds = top.map((t) => t.tenantId);
  const driverCounts = await Driver.aggregate([
    { $match: { tenantId: { $in: tenantIds } } },
    { $group: { _id: "$tenantId", drivers: { $sum: 1 } } },
  ]);
  const driverMap = new Map<string, number>(
    driverCounts.map((d) => [String(d._id), d.drivers as number]),
  );

  return top.map((t) => ({
    ...t,
    tenantId: String(t.tenantId),
    drivers: driverMap.get(String(t.tenantId)) ?? 0,
  }));
}

export async function getRecentTenants(limit = 5) {
  return Tenant.find({ status: { $ne: "DELETED" } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

/**
 * Per-tenant counts (vehicles + drivers + users), keyed by tenantId.
 * Used by the superadmin's filterable list pages to display counts in the
 * tenant-picker dropdown.
 */
export async function getCountsByTenant(): Promise<
  Map<string, { vehicles: number; drivers: number }>
> {
  const [vehiclesAgg, driversAgg] = await Promise.all([
    Vehicle.aggregate([
      { $group: { _id: "$tenantId", count: { $sum: 1 } } },
    ]),
    Driver.aggregate([{ $group: { _id: "$tenantId", count: { $sum: 1 } } }]),
  ]);

  const map = new Map<string, { vehicles: number; drivers: number }>();
  for (const v of vehiclesAgg) {
    const key = String(v._id);
    const entry = map.get(key) ?? { vehicles: 0, drivers: 0 };
    entry.vehicles = v.count as number;
    map.set(key, entry);
  }
  for (const d of driversAgg) {
    const key = String(d._id);
    const entry = map.get(key) ?? { vehicles: 0, drivers: 0 };
    entry.drivers = d.count as number;
    map.set(key, entry);
  }
  return map;
}
