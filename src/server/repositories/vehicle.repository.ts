import "server-only";
import { Types } from "mongoose";
import {
  Challan,
  ComplianceDocument,
  Driver,
  ServicePart,
  Tyre,
  TyreReplacement,
  Vehicle,
  VehicleDriverMapping,
  VehicleGroup,
  VehicleSale,
} from "@/models";
import {
  ALL_TENANTS,
  type ScopedContext,
  tenantFilter,
  tenantStamp,
} from "@/lib/auth/tenant-context";

export type VehicleListQuery = {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  groupId?: string;
  vehicleUsage?: "PRIVATE" | "COMMERCIAL";
  lifecycle?: "ACTIVE" | "SOLD";
  brand?: string;
};

type Paginated<T> = {
  vehicles: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

type EnrichedVehicle = Record<string, unknown> & {
  _id: unknown;
  groups?: unknown[];
  complianceDocuments: unknown[];
  challans: unknown[];
  driverMappings: Array<Record<string, unknown>>;
};

export async function findAll(
  ctx: ScopedContext,
  {
    page = 1,
    limit = 10,
    search,
    status,
    groupId,
    vehicleUsage,
    lifecycle,
    brand,
  }: VehicleListQuery,
): Promise<Paginated<EnrichedVehicle>> {
  const skip = (page - 1) * limit;
  const extras: Record<string, unknown> = {};

  if (search) {
    extras.$or = [
      { registrationNumber: { $regex: search, $options: "i" } },
      { make: { $regex: search, $options: "i" } },
      { model: { $regex: search, $options: "i" } },
    ];
  }
  // Mongoose matches `groupIds: id` as "array contains id" — no $in needed.
  if (groupId) extras.groupIds = groupId;
  if (vehicleUsage) extras.vehicleUsage = vehicleUsage;
  if (lifecycle) extras.status = lifecycle;
  if (brand) {
    // `__none__` is the dashboard's "Unbranded" sentinel — vehicles whose
    // brand field is missing, null, or empty. Match exactly that.
    if (brand === "__none__") {
      extras.$or = [
        { brand: null },
        { brand: { $exists: false } },
        { brand: "" },
      ];
    } else {
      extras.brand = { $regex: `^${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" };
    }
  }

  if (status) {
    const vehicleIdsWithStatus = await ComplianceDocument.find(
      tenantFilter(ctx, { status, isActive: true }),
    ).distinct("vehicleId");
    extras._id = { $in: vehicleIdsWithStatus };
  }

  const filter = tenantFilter(ctx, extras);

  const [vehicles, total] = await Promise.all([
    Vehicle.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean(),
    Vehicle.countDocuments(filter),
  ]);

  if (vehicles.length === 0) {
    return {
      vehicles: [],
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  const vehicleIds = vehicles.map((v) => v._id);
  const allGroupIds = vehicles.flatMap((v) =>
    Array.isArray(v.groupIds) ? v.groupIds : [],
  );
  const uniqueGroupIds = Array.from(new Set(allGroupIds.map((g) => String(g))));

  const [groups, complianceDocs, pendingChallans, activeMappings, sales] =
    await Promise.all([
      uniqueGroupIds.length
        ? VehicleGroup.find(
            tenantFilter(ctx, { _id: { $in: uniqueGroupIds } }),
          ).lean()
        : [],
      ComplianceDocument.find(
        tenantFilter(ctx, { vehicleId: { $in: vehicleIds }, isActive: true }),
      ).lean(),
      Challan.find(
        tenantFilter(ctx, { vehicleId: { $in: vehicleIds }, status: "PENDING" }),
      ).lean(),
      VehicleDriverMapping.find(
        tenantFilter(ctx, { vehicleId: { $in: vehicleIds }, isActive: true }),
      )
        .populate({ path: "driverId", model: Driver })
        .lean(),
      lifecycle === "SOLD"
        ? VehicleSale.find(
            tenantFilter(ctx, { vehicleId: { $in: vehicleIds } }),
          ).lean()
        : Promise.resolve([] as Array<Record<string, unknown>>),
    ]);

  const groupsById = new Map(groups.map((g) => [String(g._id), g]));
  const complianceByVehicle = new Map<string, Array<Record<string, unknown>>>();
  for (const d of complianceDocs) {
    const key = String(d.vehicleId);
    if (!complianceByVehicle.has(key)) complianceByVehicle.set(key, []);
    complianceByVehicle.get(key)!.push(d);
  }
  const challansByVehicle = new Map<string, Array<Record<string, unknown>>>();
  for (const c of pendingChallans) {
    const key = String(c.vehicleId);
    if (!challansByVehicle.has(key)) challansByVehicle.set(key, []);
    challansByVehicle.get(key)!.push(c);
  }
  const mappingsByVehicle = new Map<string, Array<Record<string, unknown>>>();
  for (const m of activeMappings as unknown as Array<
    Record<string, unknown> & { vehicleId: unknown; driverId: unknown }
  >) {
    const key = String(m.vehicleId);
    if (!mappingsByVehicle.has(key)) mappingsByVehicle.set(key, []);
    mappingsByVehicle.get(key)!.push({
      ...m,
      driver: m.driverId,
    });
  }

  const salesByVehicle = new Map<string, Record<string, unknown>>();
  for (const s of sales as Array<Record<string, unknown>>) {
    salesByVehicle.set(String(s.vehicleId), s);
  }

  const enriched: EnrichedVehicle[] = vehicles.map((v) => {
    const vGroupIds: unknown[] = Array.isArray(v.groupIds) ? v.groupIds : [];
    const groupsForVehicle = vGroupIds
      .map((gid) => groupsById.get(String(gid)))
      .filter((g): g is NonNullable<typeof g> => Boolean(g));
    return {
      ...v,
      groups: groupsForVehicle,
      complianceDocuments: complianceByVehicle.get(String(v._id)) ?? [],
      challans: challansByVehicle.get(String(v._id)) ?? [],
      driverMappings: mappingsByVehicle.get(String(v._id)) ?? [],
      sale: salesByVehicle.get(String(v._id)) ?? null,
    };
  });

  return {
    vehicles: enriched,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function findById(
  ctx: ScopedContext,
  id: string,
): Promise<EnrichedVehicle | null> {
  const vehicle = await Vehicle.findOne(tenantFilter(ctx, { _id: id })).lean();
  if (!vehicle) return null;

  const vGroupIds = Array.isArray(vehicle.groupIds) ? vehicle.groupIds : [];
  const [
    groups,
    complianceDocuments,
    challans,
    driverMappings,
    tyres,
    serviceParts,
    sale,
  ] = await Promise.all([
    vGroupIds.length
      ? VehicleGroup.find(
          tenantFilter(ctx, { _id: { $in: vGroupIds } }),
        ).lean()
      : [],
    ComplianceDocument.find(
      tenantFilter(ctx, { vehicleId: id, isActive: true }),
    )
      .sort({ type: 1 })
      .lean(),
    Challan.find(tenantFilter(ctx, { vehicleId: id }))
      .sort({ issuedAt: -1 })
      .lean(),
    VehicleDriverMapping.find(tenantFilter(ctx, { vehicleId: id }))
      .sort({ assignedAt: -1 })
      .populate({ path: "driverId", model: Driver })
      .lean(),
    Tyre.find(tenantFilter(ctx, { vehicleId: id }))
      .sort({ position: 1 })
      .lean(),
    ServicePart.find(tenantFilter(ctx, { vehicleId: id }))
      .sort({ name: 1 })
      .lean(),
    VehicleSale.findOne(tenantFilter(ctx, { vehicleId: id })).lean(),
  ]);

  const mappings = (
    driverMappings as unknown as Array<
      Record<string, unknown> & { driverId: unknown }
    >
  ).map((m) => ({ ...m, driver: m.driverId }));

  return {
    ...vehicle,
    groups,
    complianceDocuments,
    challans,
    driverMappings: mappings,
    tyres,
    serviceParts,
    sale,
  } as unknown as EnrichedVehicle;
}

/**
 * ⚠ ESCAPE HATCH — does NOT enforce tenant scope. Public-endpoint-only.
 *
 * Used by:
 *   - `public.service.getVehiclePublic` — the unguessable `/public/vehicle/[id]`
 *     URL IS the access control; we resolve the vehicle to discover its
 *     tenantId, then build a token-scoped ctx for any follow-up writes.
 *   - `/api/public/vehicles/[id]/access` (access log POST) — same pattern.
 *
 * Returns the same enriched shape as `findById(ctx, id)`. Reads cross-tenant.
 * Grep for `findByIdAnyTenant` to audit usage — every call site must be a
 * public endpoint that intentionally needs cross-tenant resolution by ID.
 */
export async function findByIdAnyTenant(
  id: string,
): Promise<EnrichedVehicle | null> {
  const vehicle = await Vehicle.findById(id).lean();
  if (!vehicle) return null;

  const vGroupIds = Array.isArray(vehicle.groupIds) ? vehicle.groupIds : [];
  const [
    groups,
    complianceDocuments,
    challans,
    driverMappings,
    tyres,
  ] = await Promise.all([
    vGroupIds.length
      ? VehicleGroup.find({ _id: { $in: vGroupIds } }).lean()
      : [],
    ComplianceDocument.find({ vehicleId: id, isActive: true })
      .sort({ type: 1 })
      .lean(),
    Challan.find({ vehicleId: id }).sort({ issuedAt: -1 }).lean(),
    VehicleDriverMapping.find({ vehicleId: id })
      .sort({ assignedAt: -1 })
      .populate({ path: "driverId", model: Driver })
      .lean(),
    Tyre.find({ vehicleId: id }).sort({ position: 1 }).lean(),
  ]);

  const mappings = (
    driverMappings as unknown as Array<
      Record<string, unknown> & { driverId: unknown }
    >
  ).map((m) => ({ ...m, driver: m.driverId }));

  return {
    ...vehicle,
    groups,
    complianceDocuments,
    challans,
    driverMappings: mappings,
    tyres,
  } as unknown as EnrichedVehicle;
}

export async function findByRegistrationNumber(
  ctx: ScopedContext,
  registrationNumber: string,
) {
  return Vehicle.findOne(
    tenantFilter(ctx, {
      registrationNumber: registrationNumber.toUpperCase(),
    }),
  ).lean();
}

export async function create(
  ctx: ScopedContext,
  data: Record<string, unknown>,
) {
  return Vehicle.create({
    ...data,
    ...tenantStamp(ctx),
    registrationNumber: String(data.registrationNumber).toUpperCase(),
  });
}

export async function update(
  ctx: ScopedContext,
  id: string,
  data: Record<string, unknown>,
) {
  return Vehicle.findOneAndUpdate(tenantFilter(ctx, { _id: id }), data, {
    new: true,
  });
}

export async function getDashboardStats(ctx: ScopedContext) {
  const [
    totalVehicles,
    greenDocs,
    yellowDocs,
    orangeDocs,
    redDocs,
    brandAgg,
    tyreReplacements,
  ] = await Promise.all([
    Vehicle.countDocuments(tenantFilter(ctx)),
    ComplianceDocument.countDocuments(
      tenantFilter(ctx, { status: "GREEN", isActive: true }),
    ),
    ComplianceDocument.countDocuments(
      tenantFilter(ctx, { status: "YELLOW", isActive: true }),
    ),
    ComplianceDocument.countDocuments(
      tenantFilter(ctx, { status: "ORANGE", isActive: true }),
    ),
    ComplianceDocument.countDocuments(
      tenantFilter(ctx, { status: "RED", isActive: true }),
    ),
    Vehicle.aggregate<{ brand: string | null; count: number }>([
      // Mongoose's aggregate $match does NOT auto-cast string IDs to
      // ObjectId (unlike find/countDocuments) — must cast manually.
      {
        $match:
          ctx.tenantId === ALL_TENANTS
            ? {}
            : { tenantId: new Types.ObjectId(ctx.tenantId) },
      },
      {
        $group: {
          _id: { $ifNull: ["$brand", null] },
          count: { $sum: 1 },
        },
      },
      { $project: { _id: 0, brand: "$_id", count: 1 } },
      { $sort: { count: -1, brand: 1 } },
    ]),
    TyreReplacement.find(tenantFilter(ctx))
      .sort({ vehicleId: 1, date: 1, odometerKm: 1 })
      .lean(),
  ]);

  const pendingAgg = await Challan.aggregate([
    { $match: tenantFilter(ctx, { status: "PENDING" }) },
    { $group: { _id: null, sum: { $sum: "$amount" }, count: { $sum: 1 } } },
  ]);

  // Fleet-wide tyre brand performance: for each vehicle's sequence of tyre
  // replacements, the run-length of stint N is odo(N+1) − odo(N). We then
  // average run-length per brand across the whole fleet — the last stint on
  // any vehicle is excluded (still running, unknown lifetime).
  type TR = (typeof tyreReplacements)[number];
  const byVehicle = new Map<string, TR[]>();
  for (const r of tyreReplacements) {
    const v = String(r.vehicleId);
    const list = byVehicle.get(v);
    if (list) list.push(r);
    else byVehicle.set(v, [r]);
  }
  const brandStats = new Map<
    string,
    { totalKm: number; count: number; vehicleSet: Set<string> }
  >();
  for (const [vehicleId, list] of byVehicle) {
    for (let i = 0; i < list.length - 1; i++) {
      const km =
        (list[i + 1].odometerKm as number) - (list[i].odometerKm as number);
      if (km <= 0) continue;
      const brand = String(list[i].brand);
      const acc = brandStats.get(brand) ?? {
        totalKm: 0,
        count: 0,
        vehicleSet: new Set<string>(),
      };
      acc.totalKm += km;
      acc.count += 1;
      acc.vehicleSet.add(vehicleId);
      brandStats.set(brand, acc);
    }
  }
  const tyreBrandPerformance = Array.from(brandStats.entries())
    .map(([brand, s]) => ({
      brand,
      avgKm: Math.round(s.totalKm / s.count),
      replacements: s.count,
      vehicles: s.vehicleSet.size,
    }))
    .sort((a, b) => b.avgKm - a.avgKm);

  return {
    totalVehicles,
    compliance: {
      green: greenDocs,
      yellow: yellowDocs,
      orange: orangeDocs,
      red: redDocs,
    },
    byBrand: brandAgg,
    tyreBrandPerformance,
    challans: {
      pendingCount: pendingAgg[0]?.count ?? 0,
      pendingAmount: pendingAgg[0]?.sum ?? 0,
    },
  };
}
