import "server-only";
import { InsurancePolicy, Vehicle } from "@/models";
import {
  type ScopedContext,
  tenantFilter,
  tenantStamp,
} from "@/lib/auth/tenant-context";

type PolicyEnriched = Record<string, unknown> & {
  _id: unknown;
  vehicleId: unknown;
  vehicle?: unknown;
};

async function attachVehicle(
  ctx: ScopedContext,
  policy: Record<string, unknown> & { _id: unknown; vehicleId: unknown },
): Promise<PolicyEnriched> {
  const vehicle = await Vehicle.findOne(
    tenantFilter(ctx, { _id: policy.vehicleId }),
  ).lean();
  return { ...policy, vehicle };
}

async function attachVehicles(
  ctx: ScopedContext,
  policies: Array<Record<string, unknown> & { _id: unknown; vehicleId: unknown }>,
): Promise<PolicyEnriched[]> {
  const vehicleIds = [...new Set(policies.map((p) => String(p.vehicleId)))];
  const vehicles = vehicleIds.length
    ? await Vehicle.find(tenantFilter(ctx, { _id: { $in: vehicleIds } })).lean()
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

export async function findAll(
  ctx: ScopedContext,
  {
    page = 1,
    limit = 20,
    status,
    search,
  }: InsuranceListQuery = {},
) {
  const skip = (page - 1) * Number(limit);
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
      { policyNumber: { $regex: search, $options: "i" } },
      { insurer: { $regex: search, $options: "i" } },
      { vehicleId: { $in: vehicles.map((v) => v._id) } },
    ];
  }

  const filter = tenantFilter(ctx, extras);
  const [raw, total] = await Promise.all([
    InsurancePolicy.find(filter)
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 })
      .lean(),
    InsurancePolicy.countDocuments(filter),
  ]);
  const policies = await attachVehicles(ctx, raw);
  return {
    policies,
    total,
    page: Number(page),
    totalPages: Math.ceil(total / Number(limit)),
  };
}

export async function findById(ctx: ScopedContext, id: string) {
  const p = await InsurancePolicy.findOne(tenantFilter(ctx, { _id: id })).lean();
  if (!p) return null;
  return attachVehicle(ctx, p);
}

export async function findByVehicleId(ctx: ScopedContext, vehicleId: string) {
  const policies = await InsurancePolicy.find(
    tenantFilter(ctx, { vehicleId }),
  )
    .sort({ createdAt: -1 })
    .lean();
  return attachVehicles(ctx, policies);
}

export async function findActiveByVehicleId(
  ctx: ScopedContext,
  vehicleId: string,
) {
  const p = await InsurancePolicy.findOne(
    tenantFilter(ctx, {
      vehicleId,
      status: { $in: ["ACTIVE", "EXPIRING"] },
    }),
  ).lean();
  if (!p) return null;
  return attachVehicle(ctx, p);
}

export async function create(
  ctx: ScopedContext,
  data: Record<string, unknown>,
) {
  const doc = await InsurancePolicy.create({ ...data, ...tenantStamp(ctx) });
  return attachVehicle(
    ctx,
    doc.toObject() as Record<string, unknown> & {
      _id: unknown;
      vehicleId: unknown;
    },
  );
}

export async function update(
  ctx: ScopedContext,
  id: string,
  data: Record<string, unknown>,
) {
  const doc = await InsurancePolicy.findOneAndUpdate(
    tenantFilter(ctx, { _id: id }),
    data,
    { new: true },
  );
  if (!doc) return null;
  return attachVehicle(
    ctx,
    doc.toObject() as Record<string, unknown> & {
      _id: unknown;
      vehicleId: unknown;
    },
  );
}

export async function getStats(ctx: ScopedContext) {
  const [total, active, expiring, expired, premiumAgg] = await Promise.all([
    InsurancePolicy.countDocuments(tenantFilter(ctx)),
    InsurancePolicy.countDocuments(tenantFilter(ctx, { status: "ACTIVE" })),
    InsurancePolicy.countDocuments(tenantFilter(ctx, { status: "EXPIRING" })),
    InsurancePolicy.countDocuments(tenantFilter(ctx, { status: "EXPIRED" })),
    InsurancePolicy.aggregate([
      {
        $match: tenantFilter(ctx, { status: { $in: ["ACTIVE", "EXPIRING"] } }),
      },
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

export async function findAllActive(ctx: ScopedContext) {
  const policies = await InsurancePolicy.find(
    tenantFilter(ctx, {
      status: { $in: ["ACTIVE", "EXPIRING"] },
      expiryDate: { $ne: null },
    }),
  ).lean();
  return attachVehicles(ctx, policies);
}
