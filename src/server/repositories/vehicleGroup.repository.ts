import "server-only";
import mongoose from "mongoose";
import {
  DocumentType,
  GroupDocumentType,
  Vehicle,
  VehicleGroup,
} from "@/models";

type GroupEnriched = Record<string, unknown> & {
  _id: unknown;
  _count: { vehicles: number };
  requiredDocTypes: Array<Record<string, unknown>>;
};

async function enrichGroups(
  groups: Array<Record<string, unknown> & { _id: unknown }>,
): Promise<GroupEnriched[]> {
  if (groups.length === 0) return [];
  const ids = groups.map((g) => g._id);

  const [vehicleCounts, joins] = await Promise.all([
    Vehicle.aggregate([
      { $match: { groupId: { $in: ids } } },
      { $group: { _id: "$groupId", count: { $sum: 1 } } },
    ]),
    GroupDocumentType.find({ groupId: { $in: ids } })
      .populate({ path: "documentTypeId", model: DocumentType })
      .lean(),
  ]);

  const countMap = new Map<string, number>(
    vehicleCounts.map((c) => [String(c._id), c.count as number]),
  );
  const joinsByGroup = new Map<string, Array<Record<string, unknown>>>();
  for (const j of joins as unknown as Array<
    Record<string, unknown> & { groupId: unknown; documentTypeId: unknown }
  >) {
    const key = String(j.groupId);
    if (!joinsByGroup.has(key)) joinsByGroup.set(key, []);
    joinsByGroup.get(key)!.push({ ...j, documentType: j.documentTypeId });
  }

  return groups.map((g) => ({
    ...g,
    _count: { vehicles: countMap.get(String(g._id)) ?? 0 },
    requiredDocTypes: joinsByGroup.get(String(g._id)) ?? [],
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
  await GroupDocumentType.deleteMany({ groupId: id });
  return VehicleGroup.findByIdAndDelete(id);
}

export async function getVehicleCount(id: string) {
  return Vehicle.countDocuments({ groupId: id });
}

export async function setRequiredDocTypes(
  groupId: string,
  documentTypeIds: string[],
) {
  await GroupDocumentType.deleteMany({ groupId });
  if (documentTypeIds.length > 0) {
    await GroupDocumentType.insertMany(
      documentTypeIds.map((documentTypeId) => ({
        groupId: new mongoose.Types.ObjectId(groupId),
        documentTypeId: new mongoose.Types.ObjectId(documentTypeId),
      })),
    );
  }
}
