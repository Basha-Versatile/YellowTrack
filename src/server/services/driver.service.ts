import "server-only";
import { randomUUID } from "crypto";
import {
  AppError,
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/lib/errors";
import * as driverRepo from "../repositories/driver.repository";
import * as docChangeRepo from "../repositories/driverDocumentChange.repository";
import * as driverChangeRepo from "../repositories/driverChange.repository";
import * as vehicleRepo from "../repositories/vehicle.repository";
import { fetchDriverByLicense } from "./mock/dl.mock";
import { fetchDrivingLicense, type SurepassDlData } from "@/lib/surepass-dl";
import { env } from "@/lib/env";
import { storage } from "@/lib/storage";
import { calculateComplianceStatus } from "./compliance.service";

type LicenseStatus = "GREEN" | "YELLOW" | "ORANGE" | "RED";

function calculateLicenseStatus(
  licenseExpiry: Date | string,
): LicenseStatus {
  const daysLeft = Math.ceil(
    (new Date(licenseExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  if (daysLeft <= 0) return "RED";
  if (daysLeft <= 7) return "ORANGE";
  if (daysLeft <= 30) return "YELLOW";
  return "GREEN";
}

function daysToExpiry(licenseExpiry: Date | string): number {
  return Math.ceil(
    (new Date(licenseExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
}

const DRIVER_CLASS_MAP: Record<string, string[]> = {
  LMV: ["GOODS", "PASSENGER", "STATE"],
  HMV: ["GOODS", "PASSENGER", "NATIONAL", "STATE"],
  HGMV: ["GOODS", "NATIONAL", "STATE"],
  HPMV: ["PASSENGER", "NATIONAL", "STATE"],
  TRANS: ["GOODS", "PASSENGER", "NATIONAL", "STATE"],
};

function getValidVehicleClasses(driverClass: string): string[] {
  return (
    DRIVER_CLASS_MAP[driverClass.toUpperCase()] ?? [
      "GOODS",
      "PASSENGER",
      "NATIONAL",
      "STATE",
    ]
  );
}

// ── Public API ────────────────────────────────────────────────

export async function createDriver(data: Record<string, unknown>) {
  const existing = await driverRepo.findByLicenseNumber(
    String(data.licenseNumber),
  );
  if (existing) {
    throw new ConflictError("Driver with this license number already exists");
  }

  const licenseExpiry = new Date(data.licenseExpiry as string);
  if (licenseExpiry < new Date()) {
    throw new BadRequestError("Cannot add driver with expired license");
  }

  return driverRepo.create({
    ...data,
    licenseExpiry,
    verificationToken: randomUUID(),
  });
}

export async function getAllDrivers() {
  const drivers = await driverRepo.findAll();
  return drivers.map((d) => ({
    ...d,
    licenseStatus: calculateLicenseStatus(d.licenseExpiry as Date | string),
    daysToExpiry: daysToExpiry(d.licenseExpiry as Date | string),
  }));
}

export async function getDriverById(id: string) {
  const driver = await driverRepo.findById(id);
  if (!driver) throw new NotFoundError("Driver not found");
  return {
    ...driver,
    licenseStatus: calculateLicenseStatus(driver.licenseExpiry as Date | string),
    daysToExpiry: daysToExpiry(driver.licenseExpiry as Date | string),
  };
}

export async function assignDriverToVehicle(
  driverId: string,
  vehicleId: string,
) {
  const driver = await driverRepo.findById(driverId);
  if (!driver) throw new NotFoundError("Driver not found");

  if (new Date(driver.licenseExpiry as Date | string) < new Date()) {
    throw new BadRequestError("Cannot assign driver with expired license");
  }

  const vehicle = await vehicleRepo.findById(vehicleId);
  if (!vehicle) throw new NotFoundError("Vehicle not found");

  const validClasses = getValidVehicleClasses(driver.vehicleClass as string);
  const vehiclePermitType = (vehicle.permitType as string | undefined)?.toUpperCase();
  if (vehiclePermitType && !validClasses.includes(vehiclePermitType)) {
    throw new BadRequestError(
      `Driver vehicle class "${driver.vehicleClass}" is not compatible with vehicle permit type "${vehicle.permitType}"`,
    );
  }

  return driverRepo.assignToVehicle(driverId, vehicleId);
}

type NormalizedDl = {
  licenseNumber: string;
  name: string;
  phone: string | null;
  aadhaarLast4: string | null;
  licenseExpiry: Date;
  dob: Date | null;
  dateOfIssue: Date | null;
  vehicleClass: string;
  bloodGroup: string | null;
  fatherName: string | null;
  permanentAddress: string | null;
  currentAddress: string | null;
  profilePhoto: string | null;
};

function safeParseDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Upload a base64-encoded profile image from Surepass to our storage provider.
 * Returns a public URL, or null if anything goes wrong — creation must not fail
 * because of a profile photo upload issue.
 */
async function uploadProfileImageFromBase64(
  raw: string | undefined | null,
  licenseNumber: string,
): Promise<string | null> {
  if (!raw) return null;
  try {
    const stripped = raw.replace(/^data:image\/[a-zA-Z]+;base64,/, "");
    const buffer = Buffer.from(stripped, "base64");
    if (buffer.length === 0) return null;
    const stored = await storage.save({
      fieldName: `driver-photo-${licenseNumber}`,
      originalName: `${licenseNumber}.jpg`,
      contentType: "image/jpeg",
      buffer,
    });
    return stored.url;
  } catch (err) {
    console.error(
      "[AutoCreateDriver] profile image upload failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

function normalizeFromSurepassDl(data: SurepassDlData): NormalizedDl {
  const expiry = data.doe ? new Date(data.doe) : null;
  if (!expiry || Number.isNaN(expiry.getTime())) {
    throw new BadRequestError("DL response missing a valid expiry date");
  }
  return {
    licenseNumber: (data.license_number || "").toUpperCase().replace(/\s/g, ""),
    name: data.name,
    phone: null,
    aadhaarLast4: null,
    licenseExpiry: expiry,
    dob: safeParseDate(data.dob),
    dateOfIssue: safeParseDate(data.doi) ?? safeParseDate(data.transport_doi),
    vehicleClass: data.vehicle_classes?.[0] ?? "LMV",
    bloodGroup: data.blood_group || null,
    fatherName: data.father_or_husband_name || null,
    permanentAddress: data.permanent_address || null,
    currentAddress: data.temporary_address || null,
    profilePhoto: null, // filled in after upload
  };
}

function normalizeFromMock(mock: Awaited<ReturnType<typeof fetchDriverByLicense>>): NormalizedDl {
  return {
    licenseNumber: mock.licenseNumber,
    name: mock.name,
    phone: mock.phone ?? null,
    aadhaarLast4: mock.aadhaarLast4 ?? null,
    licenseExpiry: new Date(mock.licenseExpiry),
    dob: null,
    dateOfIssue: null,
    vehicleClass: mock.vehicleClass,
    bloodGroup: mock.bloodGroup ?? null,
    fatherName: mock.fatherName ?? null,
    permanentAddress: mock.permanentAddress ?? null,
    currentAddress: null,
    profilePhoto: null,
  };
}

export async function autoCreateDriver(
  licenseNumber: string,
  dob?: string | null,
) {
  const existing = await driverRepo.findByLicenseNumber(licenseNumber);
  if (existing) {
    throw new ConflictError("Driver with this license number already exists");
  }

  let normalized: NormalizedDl;

  const useRealApi =
    env.SUREPASS_DL_ENABLED && env.SUREPASS_DL_API_TOKEN && dob && dob.trim();

  if (useRealApi) {
    // Real Surepass DL lookup — errors propagate (they already carry proper HTTP codes)
    const raw = await fetchDrivingLicense(licenseNumber, String(dob).trim());
    normalized = normalizeFromSurepassDl(raw);

    // Best-effort profile photo from the license image
    if (raw.profile_image) {
      normalized.profilePhoto = await uploadProfileImageFromBase64(
        raw.profile_image,
        normalized.licenseNumber,
      );
    }
  } else {
    // Fallback to deterministic mock (local dev / missing DOB / disabled)
    let mock: Awaited<ReturnType<typeof fetchDriverByLicense>>;
    try {
      mock = await fetchDriverByLicense(licenseNumber);
    } catch {
      throw new AppError("Failed to verify license from DL database", 502);
    }
    normalized = normalizeFromMock(mock);
  }

  if (normalized.licenseExpiry < new Date()) {
    throw new BadRequestError("Cannot add driver with expired license");
  }

  const driver = await driverRepo.create({
    name: normalized.name,
    phone: normalized.phone,
    aadhaarLast4: normalized.aadhaarLast4,
    licenseNumber: normalized.licenseNumber,
    licenseExpiry: normalized.licenseExpiry,
    dob: normalized.dob,
    dateOfIssue: normalized.dateOfIssue,
    vehicleClass: normalized.vehicleClass,
    bloodGroup: normalized.bloodGroup,
    fatherName: normalized.fatherName,
    motherName: null,
    emergencyContact: null,
    currentAddress: normalized.currentAddress,
    permanentAddress: normalized.permanentAddress,
    profilePhoto: normalized.profilePhoto,
    verificationToken: randomUUID(),
  });

  const obj = driver.toObject() as Record<string, unknown>;
  return {
    ...obj,
    licenseStatus: calculateLicenseStatus(normalized.licenseExpiry),
    daysToExpiry: daysToExpiry(normalized.licenseExpiry),
    verified: true,
  };
}

export async function uploadDriverDocument(
  driverId: string,
  docData: { type: string; expiryDate?: Date | string | null; lifetime: boolean },
  fileUrl: string,
) {
  const driver = await driverRepo.findById(driverId);
  if (!driver) throw new NotFoundError("Driver not found");

  const expiryDate = docData.lifetime
    ? null
    : docData.expiryDate
      ? new Date(docData.expiryDate)
      : null;
  const status = calculateComplianceStatus(expiryDate);

  const newData = {
    driverId,
    type: docData.type,
    expiryDate,
    documentUrl: fileUrl,
    status,
    isActive: true,
  };

  const existing = await driverRepo.findActiveByDriverAndType(driverId, docData.type);
  if (existing) {
    return driverRepo.renewDocument(String(existing._id), newData);
  }
  return driverRepo.createDocument(newData);
}

export async function getDocumentHistory(driverId: string, type: string) {
  const driver = await driverRepo.findById(driverId);
  if (!driver) throw new NotFoundError("Driver not found");
  const changes = await docChangeRepo.findByDriverAndType(driverId, type);
  if (changes.length > 0) return changes;
  // Backfill: old docs may predate the change log — expose them as synthetic entries
  const docs = await driverRepo.getDocHistory(driverId, type);
  return docs.map((d) => {
    const doc = d as Record<string, unknown>;
    return {
      id: `legacy-${String(doc._id)}`,
      createdAt: doc.createdAt as Date,
      changeType: doc.isActive ? "CREATED" : "ARCHIVED",
      fields: [
        { field: "expiryDate", before: null, after: doc.expiryDate ?? null },
        { field: "documentUrl", before: null, after: doc.documentUrl ?? null },
      ],
      note: doc.isActive ? null : "Imported from legacy records",
      changedBy: null,
      documentId: String(doc._id),
      documentUrl: (doc.documentUrl as string | null) ?? null,
      isActive: Boolean(doc.isActive),
    };
  });
}

export async function renewDriverDocument(
  driverId: string,
  oldDocId: string,
  newDocData: { expiryDate?: Date | string | null; lifetime: boolean },
  fileUrl: string | null,
) {
  const oldDoc = await driverRepo.findDocById(oldDocId);
  if (!oldDoc || String(oldDoc.driverId) !== driverId) {
    throw new NotFoundError("Document not found");
  }

  const expiryDate = newDocData.lifetime
    ? null
    : newDocData.expiryDate
      ? new Date(newDocData.expiryDate)
      : null;

  return driverRepo.renewDocument(oldDocId, {
    driverId,
    type: oldDoc.type,
    expiryDate,
    documentUrl: fileUrl || oldDoc.documentUrl,
    status: calculateComplianceStatus(expiryDate),
    isActive: true,
  });
}

const SIMPLE_FIELDS = [
  "phone",
  "aadhaarLast4",
  "bloodGroup",
  "fatherName",
  "motherName",
];
const ADDRESS_FIELDS = [
  "currentAddress",
  "currentAddressLat",
  "currentAddressLng",
  "permanentAddress",
  "permanentAddressLat",
  "permanentAddressLng",
];

export async function updateDriver(
  id: string,
  data: Record<string, unknown>,
  actor: driverChangeRepo.Actor,
) {
  const driver = await driverRepo.findById(id);
  if (!driver) throw new NotFoundError("Driver not found");
  const before = driver as Record<string, unknown>;

  const updated = await driverRepo.update(id, data);
  if (!updated) throw new NotFoundError("Driver not found");
  const after = updated as Record<string, unknown>;

  // Profile fields
  const profileDiffs = driverChangeRepo.diffFields(before, after, SIMPLE_FIELDS);
  if (profileDiffs.length > 0) {
    await driverChangeRepo.logDriverChange({
      driverId: id,
      changeType: "PROFILE_UPDATED",
      fields: profileDiffs,
      actor,
    });
  }

  // Address fields (grouped — they move together)
  const addressDiffs = driverChangeRepo.diffFields(before, after, ADDRESS_FIELDS);
  if (addressDiffs.length > 0) {
    await driverChangeRepo.logDriverChange({
      driverId: id,
      changeType: "ADDRESS_UPDATED",
      fields: addressDiffs,
      actor,
    });
  }

  // Emergency contacts — serialized diff
  const ecDiffs = driverChangeRepo.diffFields(before, after, ["emergencyContacts"]);
  if (ecDiffs.length > 0) {
    await driverChangeRepo.logDriverChange({
      driverId: id,
      changeType: "EMERGENCY_CONTACTS_UPDATED",
      fields: ecDiffs,
      actor,
    });
  }

  // Profile photo
  const photoDiffs = driverChangeRepo.diffFields(before, after, ["profilePhoto"]);
  if (photoDiffs.length > 0) {
    await driverChangeRepo.logDriverChange({
      driverId: id,
      changeType: "PROFILE_PHOTO_UPDATED",
      fields: photoDiffs,
      actor,
    });
  }

  return {
    ...updated,
    licenseStatus: calculateLicenseStatus(updated.licenseExpiry as Date | string),
    daysToExpiry: daysToExpiry(updated.licenseExpiry as Date | string),
  };
}

export async function getDriverChangeLog(id: string) {
  const driver = await driverRepo.findById(id);
  if (!driver) throw new NotFoundError("Driver not found");
  return driverChangeRepo.findByDriver(id);
}

export async function adminUploadAddressPhoto(
  driverId: string,
  type: "current" | "permanent",
  photoUrl: string,
  actor: driverChangeRepo.Actor,
) {
  if (type !== "current" && type !== "permanent") {
    throw new BadRequestError("Invalid address type");
  }
  const driver = await driverRepo.findById(driverId);
  if (!driver) throw new NotFoundError("Driver not found");
  const d = driver as Record<string, unknown>;

  const field =
    type === "current" ? "currentAddressPhotos" : "permanentAddressPhotos";
  const existing = (d[field] as string[] | undefined) ?? [];
  if (existing.length >= 5) {
    throw new BadRequestError("Maximum 5 photos allowed per address");
  }
  const photos = [...existing, photoUrl];
  await driverRepo.update(driverId, { [field]: photos });
  await driverChangeRepo.logDriverChange({
    driverId,
    changeType: "ADDRESS_PHOTO_ADDED",
    fields: [{ field, before: null, after: photoUrl }],
    note: `Added ${type} address photo`,
    actor,
  });
  return { url: photoUrl, photos };
}

export async function adminDeleteAddressPhoto(
  driverId: string,
  type: "current" | "permanent",
  url: string,
  actor: driverChangeRepo.Actor,
) {
  if (type !== "current" && type !== "permanent") {
    throw new BadRequestError("Invalid address type");
  }
  const driver = await driverRepo.findById(driverId);
  if (!driver) throw new NotFoundError("Driver not found");
  const d = driver as Record<string, unknown>;

  const field =
    type === "current" ? "currentAddressPhotos" : "permanentAddressPhotos";
  const existing = (d[field] as string[] | undefined) ?? [];
  const photos = existing.filter((p) => p !== url);
  await driverRepo.update(driverId, { [field]: photos });
  await driverChangeRepo.logDriverChange({
    driverId,
    changeType: "ADDRESS_PHOTO_REMOVED",
    fields: [{ field, before: url, after: null }],
    note: `Removed ${type} address photo`,
    actor,
  });
  return { photos };
}

export async function adminUploadProfilePhoto(
  driverId: string,
  photoUrl: string,
  actor: driverChangeRepo.Actor,
) {
  const driver = await driverRepo.findById(driverId);
  if (!driver) throw new NotFoundError("Driver not found");
  const prev = (driver as Record<string, unknown>).profilePhoto ?? null;
  await driverRepo.update(driverId, { profilePhoto: photoUrl });
  await driverChangeRepo.logDriverChange({
    driverId,
    changeType: "PROFILE_PHOTO_UPDATED",
    fields: [{ field: "profilePhoto", before: prev, after: photoUrl }],
    actor,
  });
  return { profilePhoto: photoUrl };
}

export async function getDriverComplianceStats() {
  const drivers = await driverRepo.findAll();
  const totalDrivers = drivers.length;

  const license = { green: 0, yellow: 0, orange: 0, red: 0 };
  for (const d of drivers) {
    const status = calculateLicenseStatus(d.licenseExpiry as Date | string);
    license[status.toLowerCase() as "green" | "yellow" | "orange" | "red"]++;
  }

  const docs = { green: 0, yellow: 0, orange: 0, red: 0 };
  for (const d of drivers) {
    const driverDocs = d.documents as Array<{
      type?: string;
      expiryDate?: Date | string | null;
    }>;
    for (const doc of driverDocs) {
      // Skip uploaded DL records — they're conceptually the same doc as the driver's
      // licenseExpiry and are already counted in the `license` bucket above.
      if (doc.type === "DL") continue;
      if (!doc.expiryDate) {
        docs.green++;
        continue;
      }
      const days = Math.ceil(
        (new Date(doc.expiryDate).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24),
      );
      if (days > 30) docs.green++;
      else if (days > 7) docs.yellow++;
      else if (days > 0) docs.orange++;
      else docs.red++;
    }
  }

  return { totalDrivers, license, documents: docs };
}

export async function toggleAdminVerification(id: string) {
  const driver = await driverRepo.findById(id);
  if (!driver) throw new NotFoundError("Driver not found");
  const current = Boolean(driver.adminVerified);
  if (!current && !driver.selfVerifiedAt) {
    throw new BadRequestError(
      "Driver has not submitted for verification yet — admin cannot verify until the driver self-submits via the verification link.",
    );
  }
  const updateData = current
    ? { adminVerified: false, selfVerifiedAt: null }
    : { adminVerified: true };
  return driverRepo.update(id, updateData);
}
