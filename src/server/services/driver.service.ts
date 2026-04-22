import "server-only";
import { randomUUID } from "crypto";
import {
  AppError,
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/lib/errors";
import * as driverRepo from "../repositories/driver.repository";
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
  vehicleClass: string;
  bloodGroup: string | null;
  fatherName: string | null;
  permanentAddress: string | null;
  currentAddress: string | null;
  profilePhoto: string | null;
};

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
  return driverRepo.getDocHistory(driverId, type);
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

export async function updateDriver(id: string, data: Record<string, unknown>) {
  const driver = await driverRepo.findById(id);
  if (!driver) throw new NotFoundError("Driver not found");
  const updated = await driverRepo.update(id, data);
  if (!updated) throw new NotFoundError("Driver not found");
  return {
    ...updated,
    licenseStatus: calculateLicenseStatus(updated.licenseExpiry as Date | string),
    daysToExpiry: daysToExpiry(updated.licenseExpiry as Date | string),
  };
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
      expiryDate?: Date | string | null;
    }>;
    for (const doc of driverDocs) {
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
  const updateData = current
    ? { adminVerified: false, selfVerifiedAt: null }
    : { adminVerified: true };
  return driverRepo.update(id, updateData);
}
