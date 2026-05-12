import "server-only";
import mongoose from "mongoose";
import { ComplianceDocument } from "@/models";
import {
  type ScopedContext,
  tenantFilter,
  tenantStamp,
} from "@/lib/auth/tenant-context";

export async function findByVehicleId(
  ctx: ScopedContext,
  vehicleId: string,
  includeArchived = false,
) {
  const extras: Record<string, unknown> = { vehicleId };
  if (!includeArchived) extras.isActive = true;
  return ComplianceDocument.find(tenantFilter(ctx, extras))
    .sort({ isActive: -1, type: 1, createdAt: -1 })
    .lean();
}

export async function findActiveForVehicleIds(
  ctx: ScopedContext,
  vehicleIds: string[],
) {
  if (vehicleIds.length === 0) return [];
  return ComplianceDocument.find(
    tenantFilter(ctx, { vehicleId: { $in: vehicleIds }, isActive: true }),
  ).lean();
}

export async function findAll(ctx: ScopedContext) {
  return ComplianceDocument.find(
    tenantFilter(ctx, { isActive: { $ne: false } }),
  ).lean();
}

export async function findById(ctx: ScopedContext, id: string) {
  return ComplianceDocument.findOne(tenantFilter(ctx, { _id: id })).lean();
}

export async function findActiveVehicleIdsByStatus(
  ctx: ScopedContext,
  status: string,
): Promise<string[]> {
  const rows = await ComplianceDocument.find(
    tenantFilter(ctx, { status, isActive: true }),
  )
    .select("vehicleId")
    .lean();
  return rows.map((r) => String(r.vehicleId));
}

export async function updateStatus(
  ctx: ScopedContext,
  id: string,
  status: string,
) {
  return ComplianceDocument.findOneAndUpdate(
    tenantFilter(ctx, { _id: id }),
    { status, lastVerifiedAt: new Date() },
  );
}

export async function updateDocumentUrl(
  ctx: ScopedContext,
  id: string,
  documentUrl: string,
) {
  return ComplianceDocument.findOneAndUpdate(
    tenantFilter(ctx, { _id: id }),
    { documentUrl },
  );
}

export async function updateExpiry(
  ctx: ScopedContext,
  id: string,
  expiryDate: Date | null,
  status: string,
) {
  return ComplianceDocument.findOneAndUpdate(
    tenantFilter(ctx, { _id: id }),
    {
      expiryDate,
      status,
      lastVerifiedAt: new Date(),
    },
  );
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

export async function createOne(
  ctx: ScopedContext,
  data: Record<string, unknown>,
) {
  return ComplianceDocument.create({
    ...data,
    ...tenantStamp(ctx),
    vehicleId:
      typeof data.vehicleId === "string"
        ? new mongoose.Types.ObjectId(data.vehicleId as string)
        : data.vehicleId,
  });
}

export async function removeById(ctx: ScopedContext, id: string) {
  return ComplianceDocument.findOneAndDelete(tenantFilter(ctx, { _id: id }));
}

export async function renewDocument(
  ctx: ScopedContext,
  oldDocId: string,
  newData: Record<string, unknown>,
) {
  // Archive old
  await ComplianceDocument.findOneAndUpdate(
    tenantFilter(ctx, { _id: oldDocId }),
    { isActive: false, archivedAt: new Date() },
  );
  // Create new
  return ComplianceDocument.create({ ...newData, ...tenantStamp(ctx) });
}

export async function getHistory(
  ctx: ScopedContext,
  vehicleId: string,
  type: string,
) {
  return ComplianceDocument.find(tenantFilter(ctx, { vehicleId, type }))
    .sort({ createdAt: -1 })
    .lean();
}
