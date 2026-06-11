import "server-only";
import { AppError, BadRequestError, NotFoundError, ConflictError } from "@/lib/errors";
import { fetchRcDetails } from "@/lib/surepass";
import {
  COMPLIANCE_DOC_TYPES,
  InsurancePolicy,
  Vehicle,
  VehicleDeletionOtp,
  VehicleDriverMapping,
} from "@/models";
import { type ScopedContext, tenantFilter, tenantStamp } from "@/lib/auth/tenant-context";
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
import { assertQuota } from "./quota.service";
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
  ctx: ScopedContext,
  registrationNumber: string,
  images: string[] = [],
  groupIds: string[] | null | undefined,
  origin?: string,
  vehicleUsage?: "PRIVATE" | "COMMERCIAL" | null,
) {
  const stamp = tenantStamp(ctx);

  // Plan-level quota guard — block before any external API spend.
  await assertQuota(stamp.tenantId, "vehicle");

  // No group selected during onboarding → assign to the default "Others" group
  let resolvedGroupIds = Array.isArray(groupIds) ? groupIds.filter(Boolean) : [];
  if (resolvedGroupIds.length === 0) {
    const others = await vehicleGroupRepo.findOrCreateOthers(ctx);
    resolvedGroupIds = [String(others._id)];
  }

  // 1. duplicate check first — avoids burning a Surepass credit
  const existing = await vehicleRepo.findByRegistrationNumber(ctx, registrationNumber);
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

  // 4. hard block only on blacklist (stolen / criminal flag).
  // Non-ACTIVE rc_status values (Fitness Expired, Permit Expired, Tax Due, etc.)
  // are document-compliance issues — surface as warnings, don't block onboarding.
  const blacklist = surepassData.blacklist_status as string | undefined;
  if (blacklist && String(blacklist).trim() !== "") {
    throw new AppError(
      `Vehicle is blacklisted (${blacklist}) — onboarding blocked`,
      403,
    );
  }

  // 5. map + create (or restore)
  const vehicleData = mapSurepassToVehicle(surepassData);
  const warnings: string[] = [];

  const rcStatus = surepassData.rc_status as string | undefined;
  if (rcStatus && rcStatus.toUpperCase() !== "ACTIVE") {
    warnings.push(`RC status: ${rcStatus}. Please update affected documents.`);
  }

  // If a soft-deleted row exists for this plate, restore it in place so all
  // related history (compliance docs, challans, EMI, FASTag, services) snaps
  // back automatically. Otherwise create a fresh row.
  const previouslyDeleted =
    await vehicleRepo.findSoftDeletedByRegistrationNumber(ctx, registrationNumber);
  let vehicleId: string;
  let isRestore = false;
  if (previouslyDeleted) {
    vehicleId = String((previouslyDeleted as { _id: unknown })._id);
    isRestore = true;
    await vehicleRepo.restoreSoftDeleted(ctx, vehicleId, {
      registrationNumber,
      ...vehicleData,
      // Preserve operator-supplied images on the new onboarding; if none
      // provided, fall back to whatever the row had before delete.
      images: images.length > 0
        ? images
        : (previouslyDeleted as { images?: string[] }).images ?? [],
      profileImage: images[0]
        ?? (previouslyDeleted as { profileImage?: string | null }).profileImage
        ?? null,
      groupIds: resolvedGroupIds,
      vehicleUsage:
        vehicleUsage
          ?? (previouslyDeleted as { vehicleUsage?: string | null }).vehicleUsage
          ?? null,
      // Preserve the prior lifecycle status. A vehicle that was SOLD before
      // deletion keeps its SOLD status on restore so its sale history (the
      // VehicleSale row, which the delete flow preserves) and Sold-tab
      // placement come back intact. Defaults to ACTIVE for vehicles that
      // weren't sold. To put a restored-sold vehicle back into service, the
      // operator can Cancel Sale from the detail page.
      status:
        (previouslyDeleted as { status?: string | null }).status ?? "ACTIVE",
    });
    const wasSold =
      (previouslyDeleted as { status?: string | null }).status === "SOLD";
    warnings.push(
      wasSold
        ? "Previous data for this vehicle was restored, including its SOLD status and sale details. Cancel the sale from the detail page to put it back into service."
        : "Previous data for this vehicle was restored (compliance, challans, services, EMI).",
    );
  } else {
    const createdDoc = await vehicleRepo.create(ctx, {
      registrationNumber,
      ...vehicleData,
      images,
      profileImage: images[0] ?? null,
      groupIds: resolvedGroupIds,
      vehicleUsage: vehicleUsage ?? null,
    });
    vehicleId = String(createdDoc._id);
  }

  // 6. QR (best-effort)
  try {
    const qrCodeUrl = await generateQRCodeForVehicle(vehicleId, origin);
    await vehicleRepo.update(ctx, vehicleId, { qrCodeUrl });
  } catch (err) {
    console.error(
      "Failed to generate QR code:",
      err instanceof Error ? err.message : err,
    );
    warnings.push(
      "QR code could not be generated — regenerate from the vehicle detail page.",
    );
  }

  // 7 & 8 are skipped on restore — compliance docs + insurance policy rows
  // were preserved by the delete service and reattach automatically to the
  // restored _id. Re-running them here would duplicate the cards.
  if (!isRestore) {
    // 7. compliance docs — seed all 6 standard types as default cards.
    // Surepass-returned expiry dates are pre-filled where available; the rest
    // are empty placeholders the admin can fill or delete from the detail page.
    try {
      const complianceDocs = COMPLIANCE_DOC_TYPES.map((type) => {
        const getter = SUREPASS_COMPLIANCE_DATE_MAP[type];
        const expiryDate = getter ? getter(surepassData) : null;
        return {
          ...stamp,
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
          ...stamp,
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
  }

  // 9. challan sync runs separately — not during onboarding

  // 10. refetch full vehicle + trigger alerts
  const fullVehicle = await vehicleRepo.findById(ctx, vehicleId);
  if (fullVehicle?.complianceDocuments) {
    for (const doc of fullVehicle.complianceDocuments as Array<{
      type: string;
      status: string;
      expiryDate?: Date | string | null;
    }>) {
      if (doc.status === "YELLOW" || doc.status === "RED") {
        await triggerVehicleAlert(
          ctx,
          registrationNumber,
          doc.type,
          doc.status,
          doc.expiryDate ?? null,
          vehicleId,
        );
      }
    }
  }

  // Fleet size grew — re-evaluate the plan tier. Auto-applies downgrades
  // / same-tier, queues a PENDING upgrade request for higher tiers (admin
  // confirms via /billing). Best-effort: a missing plan tier or a wallet
  // hiccup shouldn't block onboarding.
  try {
    const { runPlanFitForTenant } = await import("./billing.orchestrator");
    await runPlanFitForTenant(String(ctx.tenantId));
  } catch (err) {
    console.error(
      "[onboardVehicle] plan-fit failed:",
      err instanceof Error ? err.message : err,
    );
  }

  return { ...fullVehicle, warnings, restored: isRestore };
}

export async function manualOnboard(
  ctx: ScopedContext,
  data: Record<string, unknown>,
  docFiles: Record<string, string | null | undefined> = {},
  images: string[] = [],
  origin?: string,
) {
  const stamp = tenantStamp(ctx);
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
    groupIds: rawGroupIds,
  } = data as Record<string, string | number | string[] | undefined>;

  // No group selected during onboarding → assign to the default "Others" group
  let groupIds: string[] = Array.isArray(rawGroupIds)
    ? (rawGroupIds as string[]).filter(Boolean)
    : [];
  if (groupIds.length === 0) {
    const others = await vehicleGroupRepo.findOrCreateOthers(ctx);
    groupIds = [String(others._id)];
  }

  const existing = await vehicleRepo.findByRegistrationNumber(
    ctx,
    String(registrationNumber),
  );
  if (existing) {
    throw new ConflictError(
      "Vehicle with this registration number already exists",
    );
  }

  // Same restore policy as the auto-onboard path: if a soft-deleted row
  // exists for this plate, reuse its _id so related collections snap back.
  const previouslyDeleted =
    await vehicleRepo.findSoftDeletedByRegistrationNumber(
      ctx,
      String(registrationNumber),
    );
  const vehicleAttrs = {
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
    groupIds,
  };
  let vehicleId: string;
  let isRestore = false;
  if (previouslyDeleted) {
    vehicleId = String((previouslyDeleted as { _id: unknown })._id);
    isRestore = true;
    await vehicleRepo.restoreSoftDeleted(ctx, vehicleId, {
      ...vehicleAttrs,
      // Keep the prior images if the operator didn't upload anything new on
      // re-onboarding — same logic as the auto path.
      images:
        images.length > 0
          ? images
          : (previouslyDeleted as { images?: string[] }).images ?? [],
      profileImage:
        images[0]
          ?? (previouslyDeleted as { profileImage?: string | null }).profileImage
          ?? null,
      status: "ACTIVE",
    });
  } else {
    const createdDoc = await vehicleRepo.create(ctx, vehicleAttrs);
    vehicleId = String(createdDoc._id);
  }

  try {
    const qrCodeUrl = await generateQRCodeForVehicle(vehicleId, origin);
    await vehicleRepo.update(ctx, vehicleId, { qrCodeUrl });
  } catch (err) {
    console.error(
      "QR generation failed:",
      err instanceof Error ? err.message : err,
    );
  }

  if (docFiles.invoiceFile) {
    try {
      await vehicleRepo.update(ctx, vehicleId, { invoiceUrl: docFiles.invoiceFile });
    } catch (err) {
      console.error(
        "Invoice save failed:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  // Skip on restore — compliance docs were preserved by the delete service
  // and reattach via the same _id.
  if (!isRestore) {
    try {
      const complianceDocs = COMPLIANCE_DOC_TYPES.map((type) => ({
        ...stamp,
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
  }

  // Same plan-fit re-evaluation as the Surepass onboarding path.
  try {
    const { runPlanFitForTenant } = await import("./billing.orchestrator");
    await runPlanFitForTenant(String(ctx.tenantId));
  } catch (err) {
    console.error(
      "[manualOnboard] plan-fit failed:",
      err instanceof Error ? err.message : err,
    );
  }

  const full = await vehicleRepo.findById(ctx, vehicleId);
  return { ...full, restored: isRestore };
}

/**
 * Bulk-assign a brand to many vehicles in one shot. Power-user shortcut for
 * the "Unbranded" filter on the Vehicles list — the operator picks N rows
 * + a brand and clicks Assign once instead of opening each vehicle.
 *
 * Race policy (per product spec): only update rows that are STILL
 * unbranded when the write runs. If another operator branded one of the
 * selected vehicles between the operator's page load and Assign click,
 * we skip it instead of clobbering their write. The skipped count is
 * surfaced to the UI so it can render
 *   "Assigned Tata to 48 vehicles. 2 were skipped because they were
 *    already branded."
 *
 * Tenant-scoped at the repo layer via `tenantFilter`. Soft-deleted rows
 * are filtered by the Vehicle schema's pre-find middleware (defence in
 * depth — the bulk update also runs through Mongoose, not raw driver).
 */
export async function bulkAssignBrand(
  ctx: ScopedContext,
  vehicleIds: string[],
  brand: string,
): Promise<{ matched: number; modified: number; skipped: number }> {
  return vehicleRepo.bulkSetBrandWhenUnbranded(ctx, vehicleIds, brand);
}

/**
 * Fleet-wide stat-card numbers for the Vehicles page. Counts every vehicle
 * (honouring the lifecycle tab), buckets by worst-status compliance, and
 * sums pending challan amount. Server-side aggregation only — no row data
 * leaves the DB, so this is safe to call on big fleets without tripping
 * the list endpoint's `limit` ceiling.
 */
export async function getFleetSummary(
  ctx: ScopedContext,
  filters: { lifecycle?: "ACTIVE" | "SOLD" } = {},
): Promise<{
  total: number;
  green: number;
  yellow: number;
  orange: number;
  red: number;
  pendingChallanAmount: number;
}> {
  // Run findAll with a huge limit but no pagination math — repo gives us
  // every enriched row already. For a future scale fix, swap to a single
  // $lookup pipeline; for today's fleet sizes (10s–100s) this is fine.
  const result = await vehicleRepo.findAll(ctx, {
    page: 1,
    limit: 100000,
    lifecycle: filters.lifecycle,
  });

  const counts = { total: 0, green: 0, yellow: 0, orange: 0, red: 0 };
  let pendingChallanAmount = 0;
  for (const v of result.vehicles) {
    counts.total += 1;
    const docs = v.complianceDocuments as Array<{
      expiryDate?: Date | string | null;
    }>;
    const status = getOverallStatus(docs);
    counts[status.toLowerCase() as "green" | "yellow" | "orange" | "red"] += 1;
    const pending = (v.challans as Array<{ amount: number; status: string }>)
      .filter((c) => c.status === "PENDING")
      .reduce((sum, c) => sum + c.amount, 0);
    pendingChallanAmount += pending;
  }
  return { ...counts, pendingChallanAmount };
}

export async function getAllVehicles(
  ctx: ScopedContext,
  query: vehicleRepo.VehicleListQuery,
) {
  const result = await vehicleRepo.findAll(ctx, query);
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

export async function getVehicleById(ctx: ScopedContext, id: string) {
  const vehicle = await vehicleRepo.findById(ctx, id);
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

/**
 * Edit-vehicle update. Every field is optional — only what the caller
 * supplies gets written. `null` actively clears a value, `undefined`
 * leaves it untouched (the validation preprocesses empty strings to null
 * for the user's convenience).
 *
 * Returns the freshly-enriched vehicle so the client can refresh in one
 * round-trip instead of re-fetching.
 */
export async function updateVehicleDetails(
  ctx: ScopedContext,
  id: string,
  input: Record<string, unknown>,
) {
  const existing = await vehicleRepo.findById(ctx, id);
  if (!existing) throw new NotFoundError("Vehicle not found");

  // Registration number change — re-run the duplicate check inside this
  // tenant so we don't collide with another vehicle. Partial unique index
  // on the model is the final safety net.
  const incomingReg =
    typeof input.registrationNumber === "string"
      ? input.registrationNumber.toUpperCase().replace(/\s/g, "")
      : undefined;
  if (
    incomingReg &&
    incomingReg !== (existing as { registrationNumber?: string }).registrationNumber
  ) {
    const dupe = await vehicleRepo.findByRegistrationNumber(ctx, incomingReg);
    const dupeId = dupe ? String((dupe as { _id: unknown })._id) : null;
    if (dupe && dupeId !== id) {
      throw new ConflictError(
        `Vehicle ${incomingReg} is already onboarded in this workspace`,
      );
    }
    input.registrationNumber = incomingReg;
  }

  // Strip undefined keys so they don't accidentally overwrite stored
  // values via Mongoose's set semantics.
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue;
    patch[k] = v;
  }
  if (Object.keys(patch).length === 0) {
    // Nothing to update — return the fresh enriched view anyway.
    return getVehicleById(ctx, id);
  }

  await vehicleRepo.update(ctx, id, patch);
  return getVehicleById(ctx, id);
}

export async function syncChallans(
  ctx: ScopedContext,
  vehicleId: string,
  registrationNumber: string,
) {
  const stamp = tenantStamp(ctx);
  const data = await fetchChallans(registrationNumber);
  if (data.length === 0) return;
  const challans = data.map((c) => ({
    ...stamp,
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

export async function getDashboardStats(ctx: ScopedContext) {
  const [vehicleStats, challanStats] = await Promise.all([
    vehicleRepo.getDashboardStats(ctx),
    challanRepo.getStats(ctx),
  ]);
  return { ...vehicleStats, challans: challanStats };
}

// ── Vehicle deletion (OTP-gated cascade) ──────────────────────

const DELETION_OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function requestVehicleDeletion(
  ctx: ScopedContext,
  vehicleId: string,
  userId: string,
) {
  const vehicle = await vehicleRepo.findById(ctx, vehicleId);
  if (!vehicle) throw new NotFoundError("Vehicle not found");

  // Clear any existing pending OTP for this user+vehicle so requests are idempotent.
  await VehicleDeletionOtp.deleteMany(
    tenantFilter(ctx, { vehicleId, userId }),
  );
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + DELETION_OTP_TTL_MS);
  await VehicleDeletionOtp.create({
    ...tenantStamp(ctx),
    vehicleId,
    userId,
    otp,
    expiresAt,
  });

  // For now the OTP is returned directly. When email/SMS is wired up,
  // drop `otp` from the response and dispatch via the provider instead.
  return {
    otp,
    expiresAt: expiresAt.toISOString(),
    registrationNumber: vehicle.registrationNumber as string,
  };
}

export async function confirmVehicleDeletion(
  ctx: ScopedContext,
  vehicleId: string,
  userId: string,
  otp: string,
) {
  const vehicle = await vehicleRepo.findById(ctx, vehicleId);
  if (!vehicle) throw new NotFoundError("Vehicle not found");

  const token = await VehicleDeletionOtp.findOne(
    tenantFilter(ctx, { vehicleId, userId }),
  );
  if (!token) {
    throw new BadRequestError("No active OTP — please request a new code.");
  }
  if (new Date(token.expiresAt as Date) < new Date()) {
    await VehicleDeletionOtp.deleteOne({ _id: token._id });
    throw new BadRequestError("OTP has expired — please request a new code.");
  }
  if (String(token.otp) !== otp.trim()) {
    throw new BadRequestError("Incorrect OTP.");
  }

  // SOFT DELETE: mark the vehicle as deleted and unassign the active driver.
  // Related collections (challans, compliance, EMI, fastag, services, etc.)
  // are intentionally preserved as historical evidence. Vehicle schema
  // middleware auto-filters deletedAt rows out of every query, so the vehicle
  // disappears from the UI immediately.
  await Vehicle.updateOne(
    tenantFilter(ctx, { _id: vehicleId }),
    { $set: { deletedAt: new Date() } },
    { includeDeleted: true } as never,
  );
  await VehicleDriverMapping.updateMany(
    tenantFilter(ctx, { vehicleId, isActive: true }),
    { isActive: false, unassignedAt: new Date() },
  );
  await VehicleDeletionOtp.deleteMany(tenantFilter(ctx, { vehicleId }));

  // Fleet shrank — re-evaluate the plan. Drops to a lower tier auto-apply.
  try {
    const { runPlanFitForTenant } = await import("./billing.orchestrator");
    await runPlanFitForTenant(String(ctx.tenantId));
  } catch (err) {
    console.error(
      "[confirmVehicleDeletion] plan-fit failed:",
      err instanceof Error ? err.message : err,
    );
  }

  return { deletedVehicleId: vehicleId };
}
