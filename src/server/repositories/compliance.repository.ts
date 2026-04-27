import "server-only";
import mongoose from "mongoose";
import { ComplianceDocument } from "@/models";

export async function findByVehicleId(
  vehicleId: string,
  includeArchived = false,
) {
  const filter: Record<string, unknown> = { vehicleId };
  if (!includeArchived) filter.isActive = true;
  return ComplianceDocument.find(filter)
    .sort({ isActive: -1, type: 1, createdAt: -1 })
    .lean();
}

export async function findActiveForVehicleIds(vehicleIds: string[]) {
  if (vehicleIds.length === 0) return [];
  return ComplianceDocument.find({
    vehicleId: { $in: vehicleIds },
    isActive: true,
  }).lean();
}

export async function findAll() {
  return ComplianceDocument.find({ isActive: { $ne: false } }).lean();
}

export async function findById(id: string) {
  return ComplianceDocument.findById(id).lean();
}

export async function findActiveVehicleIdsByStatus(status: string): Promise<string[]> {
  const rows = await ComplianceDocument.find({ status, isActive: true })
    .select("vehicleId")
    .lean();
  return rows.map((r) => String(r.vehicleId));
}

export async function updateStatus(id: string, status: string) {
  return ComplianceDocument.findByIdAndUpdate(id, {
    status,
    lastVerifiedAt: new Date(),
  });
}

export async function updateDocumentUrl(id: string, documentUrl: string) {
  return ComplianceDocument.findByIdAndUpdate(id, { documentUrl });
}

export async function updateExpiry(
  id: string,
  expiryDate: Date | null,
  status: string,
) {
  return ComplianceDocument.findByIdAndUpdate(id, {
    expiryDate,
    status,
    lastVerifiedAt: new Date(),
  });
}

export async function createMany(docs: Array<Record<string, unknown>>) {
  if (docs.length === 0) return [];
  return ComplianceDocument.insertMany(
    docs.map((d) => ({
      ...d,
      vehicleId:
        typeof d.vehicleId === "string"
          ? new mongoose.Types.ObjectId(d.vehicleId as string)
          : d.vehicleId,
    })),
  );
}

export async function createOne(data: Record<string, unknown>) {
  return ComplianceDocument.create({
    ...data,
    vehicleId:
      typeof data.vehicleId === "string"
        ? new mongoose.Types.ObjectId(data.vehicleId as string)
        : data.vehicleId,
  });
}

export async function removeById(id: string) {
  return ComplianceDocument.findByIdAndDelete(id);
}

export async function renewDocument(
  oldDocId: string,
  newData: Record<string, unknown>,
) {
  // Archive old
  await ComplianceDocument.findByIdAndUpdate(oldDocId, {
    isActive: false,
    archivedAt: new Date(),
  });
  // Create new
  return ComplianceDocument.create(newData);
}

export async function getHistory(vehicleId: string, type: string) {
  return ComplianceDocument.find({ vehicleId, type })
    .sort({ createdAt: -1 })
    .lean();
}
