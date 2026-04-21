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

export async function autoCreateDriver(licenseNumber: string) {
  const existing = await driverRepo.findByLicenseNumber(licenseNumber);
  if (existing) {
    throw new ConflictError("Driver with this license number already exists");
  }

  let dlData: Awaited<ReturnType<typeof fetchDriverByLicense>>;
  try {
    dlData = await fetchDriverByLicense(licenseNumber);
  } catch {
    throw new AppError("Failed to verify license from DL database", 502);
  }

  const licenseExpiry = new Date(dlData.licenseExpiry);
  if (licenseExpiry < new Date()) {
    throw new BadRequestError("Cannot add driver with expired license");
  }

  const driver = await driverRepo.create({
    name: dlData.name,
    phone: dlData.phone,
    aadhaarLast4: dlData.aadhaarLast4,
    licenseNumber: dlData.licenseNumber,
    licenseExpiry,
    vehicleClass: dlData.vehicleClass,
    bloodGroup: dlData.bloodGroup ?? null,
    fatherName: dlData.fatherName ?? null,
    motherName: null,
    emergencyContact: null,
    currentAddress: null,
    permanentAddress: dlData.permanentAddress ?? null,
    verificationToken: randomUUID(),
  });

  const obj = driver.toObject() as Record<string, unknown>;
  return {
    ...obj,
    licenseStatus: calculateLicenseStatus(licenseExpiry),
    daysToExpiry: daysToExpiry(licenseExpiry),
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
