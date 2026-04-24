import "server-only";
import mongoose from "mongoose";
import {
  Driver,
  DriverDocument,
  Vehicle,
  VehicleDriverMapping,
} from "@/models";
import { logChange } from "./driverDocumentChange.repository";

type DriverEnriched = Record<string, unknown> & {
  _id: unknown;
  documents: Array<Record<string, unknown>>;
  vehicleMappings: Array<Record<string, unknown>>;
};

export async function findAll(): Promise<DriverEnriched[]> {
  const drivers = await Driver.find().sort({ createdAt: -1 }).lean();
  if (drivers.length === 0) return [];

  const driverIds = drivers.map((d) => d._id);

  const [docs, mappings] = await Promise.all([
    DriverDocument.find({ driverId: { $in: driverIds }, isActive: true })
      .sort({ createdAt: -1 })
      .lean(),
    VehicleDriverMapping.find({ driverId: { $in: driverIds }, isActive: true })
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

export async function findById(id: string): Promise<DriverEnriched | null> {
  const driver = await Driver.findById(id).lean();
  if (!driver) return null;

  const [docs, mappings] = await Promise.all([
    DriverDocument.find({ driverId: id, isActive: true })
      .sort({ createdAt: -1 })
      .lean(),
    VehicleDriverMapping.find({ driverId: id })
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

export async function findByLicenseNumber(licenseNumber: string) {
  return Driver.findOne({ licenseNumber: licenseNumber.toUpperCase() }).lean();
}

export async function findByVerificationToken(token: string) {
  return Driver.findOne({ verificationToken: token }).lean();
}

export async function create(data: Record<string, unknown>) {
  return Driver.create(data);
}

export async function update(id: string, data: Record<string, unknown>) {
  const doc = await Driver.findByIdAndUpdate(id, data, { new: true });
  if (!doc) return null;
  return findById(id);
}

export async function assignToVehicle(driverId: string, vehicleId: string) {
  await VehicleDriverMapping.updateMany(
    { vehicleId, isActive: true },
    { isActive: false, unassignedAt: new Date() },
  );
  await VehicleDriverMapping.updateMany(
    { driverId, isActive: true },
    { isActive: false, unassignedAt: new Date() },
  );
  const mapping = await VehicleDriverMapping.create({
    driverId: new mongoose.Types.ObjectId(driverId),
    vehicleId: new mongoose.Types.ObjectId(vehicleId),
    isActive: true,
  });

  const [driver, vehicle] = await Promise.all([
    Driver.findById(driverId).lean(),
    Vehicle.findById(vehicleId).lean(),
  ]);

  return { ...mapping.toObject(), driver, vehicle };
}

export async function createDocument(data: Record<string, unknown>) {
  const doc = await DriverDocument.create(data);
  await logChange({
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
  docId: string,
  expiryDate: Date | string | null,
) {
  const prev = await DriverDocument.findById(docId).lean();
  if (!prev) return null;

  const beforeExpiry = prev.expiryDate ?? null;
  let updated;

  if (!expiryDate) {
    updated = await DriverDocument.findByIdAndUpdate(
      docId,
      { expiryDate: null, status: "GREEN" },
      { new: true },
    );
  } else {
    const days = Math.ceil(
      (new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    const status =
      days <= 0 ? "RED" : days <= 7 ? "ORANGE" : days <= 30 ? "YELLOW" : "GREEN";
    updated = await DriverDocument.findByIdAndUpdate(
      docId,
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
    await logChange({
      documentId: docId,
      driverId: String(prev.driverId),
      type: String(prev.type),
      changeType,
      fields: [{ field: "expiryDate", before: beforeExpiry, after: afterExpiry }],
    });
  }
  return updated;
}

export async function findActiveByDriverAndType(driverId: string, type: string) {
  return DriverDocument.findOne({ driverId, type, isActive: true }).lean();
}

export async function findDocById(id: string) {
  return DriverDocument.findById(id).lean();
}

export async function renewDocument(
  oldDocId: string,
  newData: Record<string, unknown>,
) {
  const oldDoc = await DriverDocument.findById(oldDocId).lean();

  await DriverDocument.findByIdAndUpdate(oldDocId, {
    isActive: false,
    archivedAt: new Date(),
  });
  if (oldDoc) {
    await logChange({
      documentId: oldDocId,
      driverId: String(oldDoc.driverId),
      type: String(oldDoc.type),
      changeType: "ARCHIVED",
      fields: [{ field: "isActive", before: true, after: false }],
      note: "Superseded by a new document",
    });
  }

  const newDoc = await DriverDocument.create(newData);

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

    await logChange({
      documentId: String(newDoc._id),
      driverId: String(newDoc.driverId),
      type: String(newDoc.type),
      changeType: fileChanged ? "FILE_REPLACED" : "EXPIRY_UPDATED",
      fields,
    });
  }

  return newDoc;
}

export async function getDocHistory(driverId: string, type: string) {
  return DriverDocument.find({ driverId, type })
    .sort({ createdAt: -1 })
    .lean();
}
