import "server-only";
import { Vehicle, VehicleGroup } from "@/models";

type GroupEnriched = Record<string, unknown> & {
  _id: unknown;
  _count: { vehicles: number };
};

async function enrichGroups(
  groups: Array<Record<string, unknown> & { _id: unknown }>,
): Promise<GroupEnriched[]> {
  if (groups.length === 0) return [];
  const ids = groups.map((g) => g._id);

  const vehicleCounts = await Vehicle.aggregate([
    { $match: { groupId: { $in: ids } } },
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

export async function findAll(): Promise<GroupEnriched[]> {
  const groups = await VehicleGroup.find().sort({ order: 1 }).lean();
  return enrichGroups(groups);
}

export async function findById(id: string): Promise<GroupEnriched | null> {
  const group = await VehicleGroup.findById(id).lean();
  if (!group) return null;
  const [enriched] = await enrichGroups([group]);
  return enriched ?? null;
}

export async function create(data: Record<string, unknown>) {
  return VehicleGroup.create(data);
}

export async function update(id: string, data: Record<string, unknown>) {
  return VehicleGroup.findByIdAndUpdate(id, data, { new: true });
}

export async function remove(id: string) {
  return VehicleGroup.findByIdAndDelete(id);
}

export async function getVehicleCount(id: string) {
  return Vehicle.countDocuments({ groupId: id });
}

/**
 * The default fallback group for vehicles onboarded without an explicit group.
 * Created on first use; subsequent calls return the existing record.
 */
export async function findOrCreateOthers() {
  const existing = await VehicleGroup.findOne({ name: "Others" });
  if (existing) return existing;
  return VehicleGroup.create({
    name: "Others",
    icon: "truck",
    color: "#6b7280",
    order: 999,
  });
}
