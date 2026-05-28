import "server-only";
import mongoose from "mongoose";
import { Vehicle, VehicleGroup } from "@/models";
import {
  ALL_TENANTS,
  type ScopedContext,
  tenantFilter,
  tenantStamp,
} from "@/lib/auth/tenant-context";

type GroupEnriched = Record<string, unknown> & {
  _id: unknown;
  _count: { vehicles: number };
};

/**
 * Aggregate pipelines skip Mongoose's auto-cast, so a string `tenantId` won't
 * match an ObjectId-typed field. Build a cast-safe match stage for aggregates.
 */
function aggregateTenantMatch(
  ctx: ScopedContext,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  if (ctx.tenantId === ALL_TENANTS) return extra;
  return {
    tenantId: new mongoose.Types.ObjectId(ctx.tenantId),
    ...extra,
  };
}

async function enrichGroups(
  ctx: ScopedContext,
  groups: Array<Record<string, unknown> & { _id: unknown }>,
): Promise<GroupEnriched[]> {
  if (groups.length === 0) return [];
  const ids = groups.map((g) => g._id);

  // A vehicle may belong to multiple groups. Unwind groupIds so each
  // membership is counted once per (vehicle, group) pair.
  const vehicleCounts = await Vehicle.aggregate([
    { $match: aggregateTenantMatch(ctx, { groupIds: { $in: ids } }) },
    { $unwind: "$groupIds" },
    { $match: aggregateTenantMatch(ctx, { groupIds: { $in: ids } }) },
    { $group: { _id: "$groupIds", count: { $sum: 1 } } },
  ]);

  const countMap = new Map<string, number>(
    vehicleCounts.map((c) => [String(c._id), c.count as number]),
  );

  return groups.map((g) => ({
    ...g,
    _count: { vehicles: countMap.get(String(g._id)) ?? 0 },
  }));
}

/**
 * Make sure every vehicle has at least one valid group. Drops stale group
 * references (deleted groups) and assigns "Others" to anyone left ungrouped.
 */
async function reassignOrphans(
  ctx: ScopedContext,
  validGroupIds: unknown[],
): Promise<void> {
  const others = await findOrCreateOthers(ctx);
  const validIds = [...validGroupIds];
  if (!validIds.some((id) => String(id) === String(others._id))) {
    validIds.push(others._id);
  }
  // 1. Strip dead group ids from each vehicle's groupIds array.
  await Vehicle.updateMany(
    tenantFilter(ctx, { groupIds: { $exists: true } }),
    { $pull: { groupIds: { $nin: validIds } } },
  );
  // 2. Vehicles that ended up with zero groups get Others added.
  await Vehicle.updateMany(
    tenantFilter(ctx, {
      $or: [{ groupIds: { $exists: false } }, { groupIds: { $size: 0 } }],
    }),
    { $addToSet: { groupIds: others._id } },
  );
}

export async function findAll(ctx: ScopedContext): Promise<GroupEnriched[]> {
  let groups = await VehicleGroup.find(tenantFilter(ctx))
    .sort({ order: 1 })
    .lean();
  await reassignOrphans(ctx, groups.map((g) => g._id));
  // findOrCreateOthers may have just created Others; re-fetch if so.
  const hadOthers = groups.some(
    (g) => (g as Record<string, unknown>).name === "Others",
  );
  if (!hadOthers) {
    groups = await VehicleGroup.find(tenantFilter(ctx))
      .sort({ order: 1 })
      .lean();
  }
  return enrichGroups(ctx, groups);
}

export async function findById(
  ctx: ScopedContext,
  id: string,
): Promise<GroupEnriched | null> {
  const group = await VehicleGroup.findOne(tenantFilter(ctx, { _id: id })).lean();
  if (!group) return null;
  const [enriched] = await enrichGroups(ctx, [group]);
  return enriched ?? null;
}

export async function create(ctx: ScopedContext, data: Record<string, unknown>) {
  return VehicleGroup.create({ ...data, ...tenantStamp(ctx) });
}

export async function update(
  ctx: ScopedContext,
  id: string,
  data: Record<string, unknown>,
) {
  return VehicleGroup.findOneAndUpdate(tenantFilter(ctx, { _id: id }), data, {
    new: true,
  });
}

export async function remove(ctx: ScopedContext, id: string) {
  return VehicleGroup.findOneAndDelete(tenantFilter(ctx, { _id: id }));
}

export async function getVehicleCount(ctx: ScopedContext, id: string) {
  return Vehicle.countDocuments(tenantFilter(ctx, { groupIds: id }));
}

/**
 * The default fallback group for vehicles onboarded without an explicit group.
 * Created on first use within the tenant; subsequent calls return it.
 */
export async function findOrCreateOthers(ctx: ScopedContext) {
  const existing = await VehicleGroup.findOne(
    tenantFilter(ctx, { name: "Others" }),
  );
  if (existing) return existing;
  return VehicleGroup.create({
    ...tenantStamp(ctx),
    name: "Others",
    icon: "truck",
    color: "#6b7280",
    order: 999,
  });
}
