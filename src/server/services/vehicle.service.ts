import "server-only";
import { AppError, BadRequestError, NotFoundError, ConflictError } from "@/lib/errors";
import { fetchRcDetails } from "@/lib/surepass";
import { COMPLIANCE_DOC_TYPES, InsurancePolicy } from "@/models";
import * as vehicleRepo from "../repositories/vehicle.repository";
import * as vehicleGroupRepo from "../repositories/vehicleGroup.repository";
import * as complianceRepo from "../repositories/compliance.repository";
import * as challanRepo from "../repositories/challan.repository";
import {
  calculateComplianceStatus,
  daysUntilExpiry,
} from "./compliance.service";
import { triggerVehicleAlert } from "./alert.service";
import { generateQRCodeForVehicle } from "./qr.service";
import { fetchChallans } from "./mock/challan.mock";

// ── Helpers ───────────────────────────────────────────────────

function toInt(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = parseInt(String(val).replace(/[^\d-]/g, ""), 10);
  return Number.isNaN(n) ? null : n;
}

function toDate(val: unknown): Date | null {
  if (!val || val === "LTT") return null;
  const d = new Date(val as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

type SurepassRc = Record<string, unknown>;

function mapSurepassToVehicle(data: SurepassRc) {
  return {
    ownerName: (data.owner_name as string) || null,
    make: (data.maker_description as string) || "Unknown",
    model: (data.maker_model as string) || "Unknown",
    fuelType: (data.fuel_type as string) || "Unknown",
    chassisNumber: (data.vehicle_chasi_number as string) || null,
    engineNumber: (data.vehicle_engine_number as string) || null,
    gvw: toInt(data.vehicle_gross_weight),
    seatingCapacity: toInt(data.seat_capacity),
    permitType: (data.permit_type as string) || null,
    registrationDate: toDate(data.registration_date),
    rcStatus: (data.rc_status as string) || null,
    blacklistStatus: (data.blacklist_status as string) || null,
    financed:
      typeof data.financed === "boolean" ? (data.financed as boolean) : null,
    financer: (data.financer as string) || null,
    ownerNumber: toInt(data.owner_number),
    registeredAt: (data.registered_at as string) || null,
    manufacturingDate: (data.manufacturing_date as string) || null,
    ownerPhone: (data.mobile_number as string) || null,
    ownerAddress: (data.present_address as string) || null,
    fatherName: (data.father_name as string) || null,
    color: (data.color as string) || null,
    bodyType: (data.body_type as string) || null,
    vehicleCategory: (data.vehicle_category as string) || null,
    normsType: (data.norms_type as string) || null,
    cubicCapacity: (data.cubic_capacity as string) || null,
    cylinders: toInt(data.no_cylinders),
    wheelbase: toInt(data.wheelbase),
    unladenWeight: toInt(data.unladen_weight),
    taxMode: (data.tax_paid_upto as string) || null,
    surepassRaw: data,
  };
}

const SUREPASS_COMPLIANCE_DATE_MAP: Record<string, (d: SurepassRc) => Date | null> = {
  FITNESS: (d) => toDate(d.fit_up_to),
  INSURANCE: (d) => toDate(d.insurance_upto),
  PERMIT: (d) => toDate(d.permit_valid_upto),
  PUCC: (d) => toDate(d.pucc_upto),
  TAX: (d) =>
    d.tax_paid_upto === "LTT" ? null : toDate(d.tax_upto),
  // RC — Surepass does not provide RC expiry directly. Operator sets manually.
};

function getOverallStatus(
  docs: Array<{ expiryDate?: Date | string | null }>,
): "GREEN" | "YELLOW" | "ORANGE" | "RED" {
  if (!docs || docs.length === 0) return "GREEN";
  const statuses = docs.map((d) => calculateComplianceStatus(d.expiryDate));
  if (statuses.includes("RED")) return "RED";
  if (statuses.includes("ORANGE")) return "ORANGE";
  if (statuses.includes("YELLOW")) return "YELLOW";
  return "GREEN";
}

// ── Public API ────────────────────────────────────────────────

export async function onboardVehicle(
  registrationNumber: string,
  images: string[] = [],
  groupId: string | null,
  origin?: string,
  vehicleUsage?: "PRIVATE" | "COMMERCIAL" | null,
) {
  // No group selected during onboarding → assign to the default "Others" group
  if (!groupId) {
    const others = await vehicleGroupRepo.findOrCreateOthers();
    groupId = String(others._id);
  }

  // 1. duplicate check first — avoids burning a Surepass credit
  const existing = await vehicleRepo.findByRegistrationNumber(registrationNumber);
  if (existing) {
    const onboardedOn = existing.createdAt
      ? new Date(existing.createdAt).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : null;
    const suffix = onboardedOn ? ` on ${onboardedOn}` : "";
    throw new ConflictError(
      `Vehicle ${registrationNumber} is already onboarded${suffix}`,
    );
  }

  // 2. fetch from Surepass
  const surepassData = (await fetchRcDetails(registrationNumber)) as SurepassRc;

  // 4. hard block on inactive/blacklisted
  const rcStatus = surepassData.rc_status as string | undefined;
  if (rcStatus && rcStatus.toUpperCase() !== "ACTIVE") {
    throw new AppError(
      `Vehicle RC status is ${rcStatus} — onboarding blocked`,
      403,
    );
  }
  const blacklist = surepassData.blacklist_status as string | undefined;
  if (blacklist && String(blacklist).trim() !== "") {
    throw new AppError(
      `Vehicle is blacklisted (${blacklist}) — onboarding blocked`,
      403,
    );
  }

  // 5. map + create
  const vehicleData = mapSurepassToVehicle(surepassData);
  const warnings: string[] = [];

  const createdDoc = await vehicleRepo.create({
    registrationNumber,
    ...vehicleData,
    images,
    profileImage: images[0] ?? null,
    groupId,
    vehicleUsage: vehicleUsage ?? null,
  });
  const vehicleId = String(createdDoc._id);

  // 6. QR (best-effort)
  try {
    const qrCodeUrl = await generateQRCodeForVehicle(vehicleId, origin);
    await vehicleRepo.update(vehicleId, { qrCodeUrl });
  } catch (err) {
    console.error(
      "Failed to generate QR code:",
      err instanceof Error ? err.message : err,
    );
    warnings.push(
      "QR code could not be generated — regenerate from the vehicle detail page.",
    );
  }

  // 7. compliance docs — seed all 6 standard types as default cards.
  // Surepass-returned expiry dates are pre-filled where available; the rest
  // are empty placeholders the admin can fill or delete from the detail page.
  try {
    const complianceDocs = COMPLIANCE_DOC_TYPES.map((type) => {
      const getter = SUREPASS_COMPLIANCE_DATE_MAP[type];
      const expiryDate = getter ? getter(surepassData) : null;
      return {
        vehicleId,
        type,
        expiryDate,
        status: calculateComplianceStatus(expiryDate),
        lastVerifiedAt: new Date(),
      };
    });
    await complianceRepo.createMany(complianceDocs);
  } catch (err) {
    console.error(
      "Failed to create compliance documents:",
      err instanceof Error ? err.message : err,
    );
    warnings.push(
      "Compliance documents could not be saved automatically. Please add them manually.",
    );
  }

  // 8. Insurance policy (if Surepass returned data)
  const policyNumber = surepassData.insurance_policy_number as string | undefined;
  const insurer = surepassData.insurance_company as string | undefined;
  if (policyNumber || insurer) {
    try {
      await InsurancePolicy.create({
        vehicleId,
        policyNumber: policyNumber ?? null,
        insurer: insurer ?? null,
        expiryDate: toDate(surepassData.insurance_upto),
        status: "ACTIVE",
      });
    } catch (err) {
      console.error(
        "Failed to create insurance policy:",
        err instanceof Error ? err.message : err,
      );
      warnings.push("Insurance policy details could not be saved.");
    }
  }

  // 9. challan sync runs separately — not during onboarding

  // 10. refetch full vehicle + trigger alerts
  const fullVehicle = await vehicleRepo.findById(vehicleId);
  if (fullVehicle?.complianceDocuments) {
    for (const doc of fullVehicle.complianceDocuments as Array<{
      type: string;
      status: string;
      expiryDate?: Date | string | null;
    }>) {
      if (doc.status === "YELLOW" || doc.status === "RED") {
        await triggerVehicleAlert(
          registrationNumber,
          doc.type,
          doc.status,
          doc.expiryDate ?? null,
          vehicleId,
        );
      }
    }
  }

  return { ...fullVehicle, warnings };
}

export async function manualOnboard(
  data: Record<string, unknown>,
  docFiles: Record<string, string | null | undefined> = {},
  images: string[] = [],
  origin?: string,
) {
  const {
    registrationNumber,
    ownerName,
    make,
    model,
    fuelType,
    chassisNumber,
    engineNumber,
    gvw,
    seatingCapacity,
    permitType,
    vehicleUsage,
    groupId: rawGroupId,
  } = data as Record<string, string | number | undefined>;

  // No group selected during onboarding → assign to the default "Others" group
  let groupId = rawGroupId;
  if (!groupId) {
    const others = await vehicleGroupRepo.findOrCreateOthers();
    groupId = String(others._id);
  }

  const existing = await vehicleRepo.findByRegistrationNumber(
    String(registrationNumber),
  );
  if (existing) {
    throw new ConflictError(
      "Vehicle with this registration number already exists",
    );
  }

  const createdDoc = await vehicleRepo.create({
    registrationNumber: String(registrationNumber),
    ownerName: ownerName ?? null,
    make,
    model,
    fuelType,
    chassisNumber: chassisNumber ?? null,
    engineNumber: engineNumber ?? null,
    gvw: gvw ?? null,
    seatingCapacity: seatingCapacity ?? null,
    permitType: permitType ?? null,
    vehicleUsage:
      vehicleUsage === "PRIVATE" || vehicleUsage === "COMMERCIAL"
        ? vehicleUsage
        : null,
    images,
    profileImage: images[0] ?? null,
    groupId,
  });
  const vehicleId = String(createdDoc._id);

  try {
    const qrCodeUrl = await generateQRCodeForVehicle(vehicleId, origin);
    await vehicleRepo.update(vehicleId, { qrCodeUrl });
  } catch (err) {
    console.error(
      "QR generation failed:",
      err instanceof Error ? err.message : err,
    );
  }

  if (docFiles.invoiceFile) {
    try {
      await vehicleRepo.update(vehicleId, { invoiceUrl: docFiles.invoiceFile });
    } catch (err) {
      console.error(
        "Invoice save failed:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  // Seed all 6 standard compliance types as empty default cards. Admin can
  // upload files, edit expiry, delete unwanted ones, or add custom types
  // from the vehicle detail page. Tyres are also handled there.
  try {
    const complianceDocs = COMPLIANCE_DOC_TYPES.map((type) => ({
      vehicleId,
      type,
      expiryDate: null,
      status: calculateComplianceStatus(null),
      lastVerifiedAt: new Date(),
    }));
    await complianceRepo.createMany(complianceDocs);
  } catch (err) {
    console.error(
      "Compliance doc seeding failed:",
      err instanceof Error ? err.message : err,
    );
  }

  return vehicleRepo.findById(vehicleId);
}

export async function getAllVehicles(query: vehicleRepo.VehicleListQuery) {
  const result = await vehicleRepo.findAll(query);
  result.vehicles = result.vehicles.map((v) => {
    const docs = v.complianceDocuments as Array<{
      expiryDate?: Date | string | null;
    }>;
    const mappings = v.driverMappings as Array<{
      isActive?: boolean;
      driver?: unknown;
    }>;
    const pendingAmt = (v.challans as Array<{ amount: number; status: string }>)
      .filter((c) => c.status === "PENDING")
      .reduce((sum, c) => sum + c.amount, 0);
    return {
      ...v,
      complianceDocuments: docs.map((d) => ({
        ...d,
        status: calculateComplianceStatus(d.expiryDate),
      })),
      overallStatus: getOverallStatus(docs),
      pendingChallanAmount: pendingAmt,
      activeDriver: mappings.find((m) => m.isActive)?.driver ?? null,
    };
  });
  return result;
}

export async function getVehicleById(id: string) {
  const vehicle = await vehicleRepo.findById(id);
  if (!vehicle) throw new NotFoundError("Vehicle not found");

  const docs = vehicle.complianceDocuments as Array<{
    expiryDate?: Date | string | null;
  }>;
  const enrichedDocs = docs.map((d) => ({
    ...d,
    status: calculateComplianceStatus(d.expiryDate),
    daysUntilExpiry: daysUntilExpiry(d.expiryDate),
  }));

  const mappings = vehicle.driverMappings as Array<{
    isActive?: boolean;
    assignedAt?: Date | string;
    driver?: unknown;
  }>;
  const pendingAmt = (vehicle.challans as Array<{
    amount: number;
    status: string;
  }>)
    .filter((c) => c.status === "PENDING")
    .reduce((sum, c) => sum + c.amount, 0);

  return {
    ...vehicle,
    complianceDocuments: enrichedDocs,
    overallStatus: getOverallStatus(docs),
    pendingChallanAmount: pendingAmt,
    activeDriver: mappings.find((m) => m.isActive)?.driver ?? null,
    assignmentHistory: mappings
      .slice()
      .sort(
        (a, b) =>
          new Date(b.assignedAt ?? 0).getTime() -
          new Date(a.assignedAt ?? 0).getTime(),
      ),
  };
}

export async function syncChallans(vehicleId: string, registrationNumber: string) {
  const data = await fetchChallans(registrationNumber);
  if (data.length === 0) return;
  const challans = data.map((c) => ({
    vehicleId,
    amount: c.amount,
    userCharges: c.userCharges ?? 0,
    status: c.status,
    issuedAt: new Date(c.issuedAt),
    source: c.source,
    location: c.location ?? null,
    unitName: c.unitName ?? null,
    psLimits: c.psLimits ?? null,
    violation: c.violation ?? null,
    challanNumber: c.challanNumber ?? null,
    authorizedBy: c.authorizedBy ?? null,
    proofImageUrl: c.proofImageUrl ?? null,
  }));
  await challanRepo.createMany(challans);
}

export async function getDashboardStats() {
  const [vehicleStats, challanStats] = await Promise.all([
    vehicleRepo.getDashboardStats(),
    challanRepo.getStats(),
  ]);
  return { ...vehicleStats, challans: challanStats };
}
