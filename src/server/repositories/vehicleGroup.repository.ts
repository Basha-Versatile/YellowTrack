import "server-only";
import { Vehicle, VehicleGroup } from "@/models";
import {
  type ScopedContext,
  tenantFilter,
  tenantStamp,
} from "@/lib/auth/tenant-context";

type GroupEnriched = Record<string, unknown> & {
  _id: unknown;
  _count: { vehicles: number };
};

async function enrichGroups(
  ctx: ScopedContext,
  groups: Array<Record<string, unknown> & { _id: unknown }>,
): Promise<GroupEnriched[]> {
  if (groups.length === 0) return [];
  const ids = groups.map((g) => g._id);

  const vehicleCounts = await Vehicle.aggregate([
    { $match: tenantFilter(ctx, { groupId: { $in: ids } }) },
    { $group: { _id: "$groupId", count: { $sum: 1 } } },
  ]);

  const countMap = new Map<string, number>(
    vehicleCounts.map((c) => [String(c._id), c.count as number]),
  );

  return groups.map((g) => ({
    ...g,
    _count: { vehicles: countMap.get(String(g._id)) ?? 0 },
  }));
}

export async function findAll(ctx: ScopedContext): Promise<GroupEnriched[]> {
  const groups = await VehicleGroup.find(tenantFilter(ctx))
    .sort({ order: 1 })
    .lean();
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
  return Vehicle.countDocuments(tenantFilter(ctx, { groupId: id }));
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
