import "server-only";
import { AppError, BadRequestError, NotFoundError } from "@/lib/errors";
import * as driverRepo from "../repositories/driver.repository";
import * as vehicleRepo from "../repositories/vehicle.repository";
import {
  calculateComplianceStatus,
  daysUntilExpiry,
} from "./compliance.service";
import { create as createNotification } from "./notification.service";
import * as complianceRepo from "../repositories/compliance.repository";

export async function getVehiclePublic(vehicleId: string) {
  const vehicle = await vehicleRepo.findById(vehicleId);
  if (!vehicle) throw new NotFoundError("Vehicle not found");

  // Recalculate compliance statuses for this vehicle
  const docs = await complianceRepo.findByVehicleId(vehicleId);
  const compliance = docs.map((d) => ({
    type: d.type,
    status: calculateComplianceStatus(d.expiryDate),
    expiryDate: d.expiryDate ?? null,
    daysUntilExpiry: daysUntilExpiry(d.expiryDate),
  }));

  const mappings = vehicle.driverMappings as Array<{
    isActive?: boolean;
    driver?: { name?: string; licenseNumber?: string };
    assignedAt?: Date | string;
  }>;
  const activeMapping = mappings.find((m) => m.isActive);

  const ownerName = (vehicle.ownerName as string | undefined) ?? null;

  return {
    registrationNumber: vehicle.registrationNumber,
    make: vehicle.make,
    model: vehicle.model,
    fuelType: vehicle.fuelType,
    permitType: vehicle.permitType,
    ownerName: ownerName ? `${ownerName.charAt(0)}***` : null,
    currentDriver: activeMapping?.driver
      ? {
          name: activeMapping.driver.name,
          licenseNumber:
            (activeMapping.driver.licenseNumber ?? "").slice(0, 4) + "****",
          assignedAt: activeMapping.assignedAt,
        }
      : null,
    compliance: compliance.map((d) => ({
      type: d.type,
      status: d.status,
      expiryDate: d.expiryDate,
    })),
  };
}

export async function getDriverByToken(token: string) {
  const driver = await driverRepo.findByVerificationToken(token);
  if (!driver) throw new NotFoundError("Invalid verification link");
  const d = driver as Record<string, unknown>;
  return {
    id: String(d._id),
    name: d.name,
    phone: d.phone ?? null,
    aadhaarLast4: d.aadhaarLast4 ?? null,
    licenseNumber: d.licenseNumber,
    licenseExpiry: d.licenseExpiry,
    vehicleClass: d.vehicleClass,
    bloodGroup: d.bloodGroup ?? null,
    fatherName: d.fatherName ?? null,
    motherName: d.motherName ?? null,
    emergencyContact: d.emergencyContact ?? null,
    emergencyContacts: d.emergencyContacts ?? null,
    currentAddress: d.currentAddress ?? null,
    currentAddressPhotos: (d.currentAddressPhotos as string[] | undefined) ?? [],
    permanentAddress: d.permanentAddress ?? null,
    permanentAddressPhotos:
      (d.permanentAddressPhotos as string[] | undefined) ?? [],
    currentAddressLat: d.currentAddressLat ?? null,
    currentAddressLng: d.currentAddressLng ?? null,
    permanentAddressLat: d.permanentAddressLat ?? null,
    permanentAddressLng: d.permanentAddressLng ?? null,
    profilePhoto: d.profilePhoto ?? null,
    selfVerifiedAt: d.selfVerifiedAt ?? null,
    adminVerified: d.adminVerified ?? false,
  };
}

export async function updateDriverByToken(
  token: string,
  validated: Record<string, unknown>,
) {
  const driver = await driverRepo.findByVerificationToken(token);
  if (!driver) throw new NotFoundError("Invalid verification link");
  const d = driver as Record<string, unknown>;
  if (d.adminVerified) {
    throw new AppError(
      "Your profile has been verified by the admin. Contact admin to make changes.",
      403,
    );
  }

  const updateData = { ...validated, selfVerifiedAt: new Date() };
  const updated = await driverRepo.update(String(d._id), updateData);

  try {
    await createNotification({
      type: "DRIVER_SELF_VERIFIED",
      title: `Driver Verified — ${d.name}`,
      message: `${d.name} (${d.licenseNumber}) has submitted their profile verification. Review and approve.`,
      entityId: String(d._id),
    });
  } catch (err) {
    console.error(
      "[DRIVER_SELF_VERIFY_NOTIFICATION]",
      err instanceof Error ? err.message : err,
    );
  }

  return updated;
}

export async function uploadDriverPhoto(token: string, photoUrl: string) {
  const driver = await driverRepo.findByVerificationToken(token);
  if (!driver) throw new NotFoundError("Invalid verification link");
  await driverRepo.update(String((driver as { _id: unknown })._id), {
    profilePhoto: photoUrl,
  });
  return { profilePhoto: photoUrl };
}

export async function uploadAddressPhoto(
  token: string,
  type: "current" | "permanent",
  photoUrl: string,
) {
  if (type !== "current" && type !== "permanent") {
    throw new BadRequestError("Invalid address type");
  }
  const driver = await driverRepo.findByVerificationToken(token);
  if (!driver) throw new NotFoundError("Invalid verification link");
  const d = driver as Record<string, unknown>;

  const field =
    type === "current" ? "currentAddressPhotos" : "permanentAddressPhotos";
  const existing = (d[field] as string[] | undefined) ?? [];
  if (existing.length >= 5) {
    throw new BadRequestError("Maximum 5 photos allowed per address");
  }
  const updated = [...existing, photoUrl];
  await driverRepo.update(String(d._id), { [field]: updated });
  return { url: photoUrl, photos: updated };
}

export async function deleteAddressPhoto(
  token: string,
  type: "current" | "permanent",
  url: string,
) {
  if (type !== "current" && type !== "permanent") {
    throw new BadRequestError("Invalid address type");
  }
  const driver = await driverRepo.findByVerificationToken(token);
  if (!driver) throw new NotFoundError("Invalid verification link");
  const d = driver as Record<string, unknown>;

  const field =
    type === "current" ? "currentAddressPhotos" : "permanentAddressPhotos";
  const existing = (d[field] as string[] | undefined) ?? [];
  const updated = existing.filter((p) => p !== url);
  await driverRepo.update(String(d._id), { [field]: updated });
  return { photos: updated };
}
