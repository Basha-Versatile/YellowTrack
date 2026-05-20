import "server-only";
import mongoose from "mongoose";
import {
  Driver,
  DriverDocument,
  Vehicle,
  VehicleDriverMapping,
} from "@/models";
import {
  type ScopedContext,
  tenantFilter,
  tenantStamp,
} from "@/lib/auth/tenant-context";
import { logChange } from "./driverDocumentChange.repository";

type DriverEnriched = Record<string, unknown> & {
  _id: unknown;
  documents: Array<Record<string, unknown>>;
  vehicleMappings: Array<Record<string, unknown>>;
};

export async function findAll(ctx: ScopedContext): Promise<DriverEnriched[]> {
  const drivers = await Driver.find(tenantFilter(ctx))
    .sort({ createdAt: -1 })
    .lean();
  if (drivers.length === 0) return [];

  const driverIds = drivers.map((d) => d._id);

  const [docs, mappings] = await Promise.all([
    DriverDocument.find(
      tenantFilter(ctx, { driverId: { $in: driverIds }, isActive: true }),
    )
      .sort({ createdAt: -1 })
      .lean(),
    VehicleDriverMapping.find(
      tenantFilter(ctx, { driverId: { $in: driverIds }, isActive: true }),
    )
      .populate({ path: "vehicleId", model: Vehicle })
      .lean(),
  ]);

  const docsByDriver = new Map<string, Array<Record<string, unknown>>>();
  for (const d of docs) {
    const key = String(d.driverId);
    if (!docsByDriver.has(key)) docsByDriver.set(key, []);
    docsByDriver.get(key)!.push(d);
  }

  const mapsByDriver = new Map<string, Array<Record<string, unknown>>>();
  for (const m of mappings as unknown as Array<
    Record<string, unknown> & { driverId: unknown; vehicleId: unknown }
  >) {
    const key = String(m.driverId);
    if (!mapsByDriver.has(key)) mapsByDriver.set(key, []);
    mapsByDriver.get(key)!.push({ ...m, vehicle: m.vehicleId });
  }

  return drivers.map((d) => ({
    ...d,
    documents: docsByDriver.get(String(d._id)) ?? [],
    vehicleMappings: mapsByDriver.get(String(d._id)) ?? [],
  }));
}

export async function findById(
  ctx: ScopedContext,
  id: string,
): Promise<DriverEnriched | null> {
  const driver = await Driver.findOne(tenantFilter(ctx, { _id: id })).lean();
  if (!driver) return null;

  const [docs, mappings] = await Promise.all([
    DriverDocument.find(
      tenantFilter(ctx, { driverId: id, isActive: true }),
    )
      .sort({ createdAt: -1 })
      .lean(),
    VehicleDriverMapping.find(tenantFilter(ctx, { driverId: id }))
      .sort({ assignedAt: -1 })
      .populate({ path: "vehicleId", model: Vehicle })
      .lean(),
  ]);

  const enrichedMappings = (
    mappings as unknown as Array<
      Record<string, unknown> & { vehicleId: unknown }
    >
  ).map((m) => ({ ...m, vehicle: m.vehicleId }));

  return {
    ...driver,
    documents: docs,
    vehicleMappings: enrichedMappings,
  };
}

export async function findByLicenseNumber(
  ctx: ScopedContext,
  licenseNumber: string,
) {
  return Driver.findOne(
    tenantFilter(ctx, { licenseNumber: licenseNumber.toUpperCase() }),
  ).lean();
}

/**
 * Public driver-verify flow: verificationToken is a globally-unique, unguessable
 * secret. The token IS the access control, so this lookup is intentionally
 * cross-tenant. Only used by `public.service.getDriverByToken` and friends.
 */
export async function findByVerificationTokenAnyTenant(token: string) {
  return Driver.findOne({ verificationToken: token }).lean();
}

/**
 * Distinct list of every non-empty `medicalInsuranceName` ever entered for
 * a driver in this tenant. Used to power the "previously used providers"
 * autocomplete on the driver edit modal. Returns sorted strings.
 */
export async function findDistinctMedicalInsuranceProviders(
  ctx: ScopedContext,
): Promise<string[]> {
  const values = await Driver.distinct(
    "medicalInsuranceName",
    tenantFilter(ctx, {
      medicalInsuranceName: { $exists: true, $ne: null, $nin: ["", null] },
    }),
  );
  return (values as string[])
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => v.trim())
    .sort((a, b) => a.localeCompare(b));
}

export async function create(
  ctx: ScopedContext,
  data: Record<string, unknown>,
) {
  return Driver.create({ ...data, ...tenantStamp(ctx) });
}

export async function update(
  ctx: ScopedContext,
  id: string,
  data: Record<string, unknown>,
) {
  const doc = await Driver.findOneAndUpdate(
    tenantFilter(ctx, { _id: id }),
    data,
    { new: true, strict: false },
  );
  if (!doc) return null;
  return findById(ctx, id);
}

export async function assignToVehicle(
  ctx: ScopedContext,
  driverId: string,
  vehicleId: string,
) {
  await VehicleDriverMapping.updateMany(
    tenantFilter(ctx, { vehicleId, isActive: true }),
    { isActive: false, unassignedAt: new Date() },
  );
  await VehicleDriverMapping.updateMany(
    tenantFilter(ctx, { driverId, isActive: true }),
    { isActive: false, unassignedAt: new Date() },
  );
  const mapping = await VehicleDriverMapping.create({
    ...tenantStamp(ctx),
    driverId: new mongoose.Types.ObjectId(driverId),
    vehicleId: new mongoose.Types.ObjectId(vehicleId),
    isActive: true,
  });

  const [driver, vehicle] = await Promise.all([
    Driver.findOne(tenantFilter(ctx, { _id: driverId })).lean(),
    Vehicle.findOne(tenantFilter(ctx, { _id: vehicleId })).lean(),
  ]);

  return { ...mapping.toObject(), driver, vehicle };
}

export async function createDocument(
  ctx: ScopedContext,
  data: Record<string, unknown>,
) {
  const doc = await DriverDocument.create({ ...data, ...tenantStamp(ctx) });
  await logChange(ctx, {
    documentId: String(doc._id),
    driverId: String(doc.driverId),
    type: String(doc.type),
    changeType: "CREATED",
    fields: [
      { field: "expiryDate", before: null, after: doc.expiryDate ?? null },
      { field: "documentUrl", before: null, after: doc.documentUrl ?? null },
    ],
  });
  return doc;
}

export async function updateDocumentExpiry(
  ctx: ScopedContext,
  docId: string,
  expiryDate: Date | string | null,
) {
  const prev = await DriverDocument.findOne(
    tenantFilter(ctx, { _id: docId }),
  ).lean();
  if (!prev) return null;

  const beforeExpiry = prev.expiryDate ?? null;
  let updated;

  if (!expiryDate) {
    updated = await DriverDocument.findOneAndUpdate(
      tenantFilter(ctx, { _id: docId }),
      { expiryDate: null, status: "GREEN" },
      { new: true },
    );
  } else {
    const days = Math.ceil(
      (new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    const status =
      days <= 0 ? "RED" : days <= 7 ? "ORANGE" : days <= 30 ? "YELLOW" : "GREEN";
    updated = await DriverDocument.findOneAndUpdate(
      tenantFilter(ctx, { _id: docId }),
      { expiryDate: new Date(expiryDate), status },
      { new: true },
    );
  }

  const afterExpiry = updated?.expiryDate ?? null;
  const same =
    (beforeExpiry && afterExpiry && new Date(beforeExpiry).getTime() === new Date(afterExpiry).getTime()) ||
    (!beforeExpiry && !afterExpiry);
  if (!same) {
    const changeType =
      beforeExpiry && !afterExpiry
        ? "LIFETIME_SET"
        : !beforeExpiry && afterExpiry
          ? "LIFETIME_REMOVED"
          : "EXPIRY_UPDATED";
    await logChange(ctx, {
      documentId: docId,
      driverId: String(prev.driverId),
      type: String(prev.type),
      changeType,
      fields: [{ field: "expiryDate", before: beforeExpiry, after: afterExpiry }],
    });
  }
  return updated;
}

export async function findActiveByDriverAndType(
  ctx: ScopedContext,
  driverId: string,
  type: string,
) {
  return DriverDocument.findOne(
    tenantFilter(ctx, { driverId, type, isActive: true }),
  ).lean();
}

export async function findDocById(ctx: ScopedContext, id: string) {
  return DriverDocument.findOne(tenantFilter(ctx, { _id: id })).lean();
}

export async function renewDocument(
  ctx: ScopedContext,
  oldDocId: string,
  newData: Record<string, unknown>,
) {
  const oldDoc = await DriverDocument.findOne(
    tenantFilter(ctx, { _id: oldDocId }),
  ).lean();

  await DriverDocument.findOneAndUpdate(
    tenantFilter(ctx, { _id: oldDocId }),
    {
      isActive: false,
      archivedAt: new Date(),
    },
  );
  if (oldDoc) {
    await logChange(ctx, {
      documentId: oldDocId,
      driverId: String(oldDoc.driverId),
      type: String(oldDoc.type),
      changeType: "ARCHIVED",
      fields: [{ field: "isActive", before: true, after: false }],
      note: "Superseded by a new document",
    });
  }

  const newDoc = await DriverDocument.create({ ...newData, ...tenantStamp(ctx) });

  if (oldDoc) {
    const fileChanged = (oldDoc.documentUrl ?? null) !== (newData.documentUrl ?? null);
    const oldExpiry = oldDoc.expiryDate ? new Date(oldDoc.expiryDate).getTime() : null;
    const newExpiry = newData.expiryDate
      ? new Date(newData.expiryDate as Date | string).getTime()
      : null;
    const expiryChanged = oldExpiry !== newExpiry;

    const fields: Array<{ field: string; before: unknown; after: unknown }> = [];
    if (fileChanged) {
      fields.push({
        field: "documentUrl",
        before: oldDoc.documentUrl ?? null,
        after: newData.documentUrl ?? null,
      });
    }
    if (expiryChanged) {
      fields.push({
        field: "expiryDate",
        before: oldDoc.expiryDate ?? null,
        after: newData.expiryDate ?? null,
      });
    }

    await logChange(ctx, {
      documentId: String(newDoc._id),
      driverId: String(newDoc.driverId),
      type: String(newDoc.type),
      changeType: fileChanged ? "FILE_REPLACED" : "EXPIRY_UPDATED",
      fields,
    });
  }

  return newDoc;
}

export async function getDocHistory(
  ctx: ScopedContext,
  driverId: string,
  type: string,
) {
  return DriverDocument.find(tenantFilter(ctx, { driverId, type }))
    .sort({ createdAt: -1 })
    .lean();
}
