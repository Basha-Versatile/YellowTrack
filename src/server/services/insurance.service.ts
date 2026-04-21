import "server-only";
import { AppError, BadRequestError, NotFoundError } from "@/lib/errors";
import * as insuranceRepo from "../repositories/insurance.repository";
import * as vehicleRepo from "../repositories/vehicle.repository";
import { extractFromPDF } from "./insurance/pdfParser.service";
import { getPlans as getMockPlans } from "./mock/insurance.mock";
import { create as createNotification } from "./notification.service";

function computeStatus(expiryDate: Date | string | null | undefined) {
  if (!expiryDate) return "ACTIVE";
  const days = Math.ceil(
    (new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  if (days <= 0) return "EXPIRED";
  if (days <= 30) return "EXPIRING";
  return "ACTIVE";
}

export async function uploadAndExtract(
  vehicleId: string,
  filePath: string,
  documentUrl: string,
) {
  const vehicle = await vehicleRepo.findById(vehicleId);
  if (!vehicle) throw new NotFoundError("Vehicle not found");

  const extracted = await extractFromPDF(filePath);
  const status = computeStatus(extracted.expiryDate);

  const policy = await insuranceRepo.create({
    vehicleId,
    policyNumber: extracted.policyNumber,
    insurer:
      extracted.insurer === "Unable to detect — please fill manually"
        ? null
        : extracted.insurer,
    startDate: extracted.startDate ? new Date(extracted.startDate) : null,
    expiryDate: extracted.expiryDate ? new Date(extracted.expiryDate) : null,
    premium: extracted.premium,
    coverageType: extracted.coverageType,
    documentUrl,
    status,
    extractedData: extracted,
  });

  return { policy, extracted };
}

type SavePolicyInput = {
  vehicleId: string;
  policyNumber?: string | null;
  insurer?: string | null;
  planName?: string | null;
  startDate?: Date | string | null;
  expiryDate?: Date | string | null;
  premium?: number | null;
  coverageType?: string | null;
  coverageDetails?: string[];
  addOns?: string[];
  documentUrl?: string | null;
};

export async function savePolicy(data: SavePolicyInput) {
  const vehicle = await vehicleRepo.findById(data.vehicleId);
  if (!vehicle) throw new NotFoundError("Vehicle not found");

  const status = computeStatus(data.expiryDate);

  return insuranceRepo.create({
    vehicleId: data.vehicleId,
    policyNumber: data.policyNumber ?? null,
    insurer: data.insurer ?? null,
    planName: data.planName ?? null,
    startDate: data.startDate ? new Date(data.startDate) : null,
    expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
    premium: data.premium ? Number(data.premium) : null,
    coverageType: data.coverageType ?? null,
    coverageDetails: data.coverageDetails ?? [],
    addOns: data.addOns ?? [],
    documentUrl: data.documentUrl ?? null,
    status,
  });
}

export async function getPlans(vehicleId: string) {
  const vehicle = await vehicleRepo.findById(vehicleId);
  if (!vehicle) throw new NotFoundError("Vehicle not found");

  const existing = await insuranceRepo.findActiveByVehicleId(vehicleId);
  const previousInsurer =
    (existing as { insurer?: string | null } | null)?.insurer ?? null;

  const permitType = (vehicle.permitType as string | undefined) ?? "";
  const vehicleType =
    permitType === "GOODS"
      ? "Commercial"
      : permitType === "PASSENGER"
        ? "Passenger"
        : "Private Car";

  const plans = getMockPlans(
    String(vehicle.registrationNumber),
    vehicleType,
    previousInsurer,
  );

  return {
    vehicle: {
      id: String(vehicle._id),
      registrationNumber: vehicle.registrationNumber,
      make: vehicle.make,
      model: vehicle.model,
    },
    plans,
  };
}

type PurchaseInput = {
  vehicleId: string;
  provider: string;
  planName: string;
  premium: number;
  coverage?: string[];
  addOns?: string[];
  paymentMethod?: string;
};

export async function purchase(vehicleId: string, planData: PurchaseInput) {
  const vehicle = await vehicleRepo.findById(vehicleId);
  if (!vehicle) throw new NotFoundError("Vehicle not found");

  const paymentSuccess = Math.random() > 0.05;
  const paymentId = `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  if (!paymentSuccess) {
    throw new AppError("Payment failed. Please try again.", 402);
  }

  const existingPolicies = await insuranceRepo.findByVehicleId(vehicleId);
  for (const p of existingPolicies) {
    const status = (p as { status?: string }).status;
    if (status === "ACTIVE" || status === "EXPIRING" || status === "EXPIRED") {
      await insuranceRepo.update(String(p._id), { status: "RENEWED" });
    }
  }

  const startDate = new Date();
  const expiryDate = new Date();
  expiryDate.setFullYear(expiryDate.getFullYear() + 1);

  const policy = await insuranceRepo.create({
    vehicleId,
    policyNumber: `POL-${Date.now().toString().slice(-10)}`,
    insurer: planData.provider,
    planName: planData.planName,
    startDate,
    expiryDate,
    premium: planData.premium,
    coverageType: planData.planName,
    coverageDetails: planData.coverage ?? [],
    addOns: planData.addOns ?? [],
    status: "ACTIVE",
    paidAmount: planData.premium,
    paymentId,
    paymentStatus: "SUCCESS",
  });

  return {
    policy,
    payment: { id: paymentId, status: "SUCCESS", amount: planData.premium },
  };
}

export async function checkExpiring() {
  const policies = await insuranceRepo.findAllActive();
  let updated = 0;
  let alerts = 0;

  for (const policy of policies) {
    const expiry = (policy as { expiryDate?: Date | string | null }).expiryDate;
    if (!expiry) continue;
    const days = Math.ceil(
      (new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );

    let newStatus = "ACTIVE";
    if (days <= 0) newStatus = "EXPIRED";
    else if (days <= 30) newStatus = "EXPIRING";

    const current = (policy as { status?: string }).status;
    if (newStatus !== current) {
      await insuranceRepo.update(String(policy._id), { status: newStatus });
      updated++;
    }

    const vehicle = (policy as { vehicle?: { registrationNumber?: string } }).vehicle;
    if ((newStatus === "EXPIRING" || newStatus === "EXPIRED") && vehicle) {
      try {
        await createNotification({
          type: "INSURANCE_EXPIRY",
          title: `Insurance ${
            newStatus === "EXPIRED" ? "Expired" : "Expiring"
          } — ${vehicle.registrationNumber ?? ""}`,
          message: `Insurance policy ${
            (policy as { policyNumber?: string }).policyNumber ?? ""
          } for ${vehicle.registrationNumber ?? ""} ${
            newStatus === "EXPIRED" ? "has expired" : `expires in ${days} days`
          }. Renew now.`,
          entityId: String(policy._id),
        });
        alerts++;
      } catch {
        /* ignore */
      }
    }
  }

  return { updated, alerts };
}

export async function getAll(query: insuranceRepo.InsuranceListQuery) {
  return insuranceRepo.findAll(query);
}

export async function getById(id: string) {
  const p = await insuranceRepo.findById(id);
  if (!p) throw new NotFoundError("Policy not found");
  return p;
}

export async function getByVehicle(vehicleId: string) {
  return insuranceRepo.findByVehicleId(vehicleId);
}

export async function getStats() {
  return insuranceRepo.getStats();
}

// re-export for Wave 6 cron guard
export async function assertVehicleExists(vehicleId: string) {
  const vehicle = await vehicleRepo.findById(vehicleId);
  if (!vehicle) throw new BadRequestError("Vehicle not found");
}
