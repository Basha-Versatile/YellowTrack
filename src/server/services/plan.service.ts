import "server-only";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/lib/errors";
import { Plan } from "@/models";
import * as planRepo from "../repositories/plan.repository";

export type PlanInput = {
  name: string;
  description?: string | null;
  currency?: string;
  isActive?: boolean;
  fleetSizeMin?: number;
  fleetSizeMax?: number | null;
  perVehiclePerMonth: number;
  perVehiclePerYear: number;
  perDriverPerMonth?: number;
  customComplianceGroupPerMonth?: number;
  customComplianceDocsPerGroupLimit?: number;
  gstPercent?: number;
};

function normalizeBounds(
  min: number,
  max: number | null | undefined,
): { fleetSizeMin: number; fleetSizeMax: number | null } {
  const safeMin = Number.isFinite(min) && min >= 0 ? Math.floor(min) : 0;
  if (max === null || max === undefined) {
    return { fleetSizeMin: safeMin, fleetSizeMax: null };
  }
  const safeMax = Number.isFinite(max) && max >= 0 ? Math.floor(max) : null;
  if (safeMax === null) return { fleetSizeMin: safeMin, fleetSizeMax: null };
  if (safeMax < safeMin) {
    throw new BadRequestError(
      "Fleet-size max must be greater than or equal to min",
    );
  }
  return { fleetSizeMin: safeMin, fleetSizeMax: safeMax };
}

export async function listPlans(opts: { includeInactive?: boolean } = {}) {
  return planRepo.findAll(opts);
}

export async function listActivePlans() {
  return planRepo.findActive();
}

export async function getPlanById(id: string) {
  const plan = await planRepo.findById(id);
  if (!plan) throw new NotFoundError("Plan not found");
  return plan;
}

export async function createPlan(input: PlanInput) {
  const name = input.name.trim();
  if (!name) throw new BadRequestError("Plan name is required");

  const dup = await planRepo.findByName(name);
  if (dup) throw new ConflictError("A plan with this name already exists");

  const bounds = normalizeBounds(input.fleetSizeMin ?? 0, input.fleetSizeMax);

  return planRepo.create({
    name,
    description: input.description?.trim() ?? null,
    currency: (input.currency ?? "INR").toUpperCase(),
    isActive: input.isActive ?? true,
    fleetSizeMin: bounds.fleetSizeMin,
    fleetSizeMax: bounds.fleetSizeMax,
    perVehiclePerMonth: input.perVehiclePerMonth,
    perVehiclePerYear: input.perVehiclePerYear,
    perDriverPerMonth: input.perDriverPerMonth ?? 0,
    customComplianceGroupPerMonth: input.customComplianceGroupPerMonth ?? 30,
    customComplianceDocsPerGroupLimit:
      input.customComplianceDocsPerGroupLimit ?? 20,
    gstPercent: input.gstPercent ?? 18,
  });
}

export async function updatePlan(id: string, input: Partial<PlanInput>) {
  const current = await planRepo.findById(id);
  if (!current) throw new NotFoundError("Plan not found");

  const patch: Record<string, unknown> = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new BadRequestError("Plan name is required");
    if (name !== current.name) {
      const dup = await planRepo.findByName(name);
      if (dup) throw new ConflictError("A plan with this name already exists");
    }
    patch.name = name;
  }
  if (input.description !== undefined) {
    patch.description = input.description?.trim() ?? null;
  }
  if (input.currency !== undefined) {
    patch.currency = input.currency.toUpperCase();
  }
  if (input.isActive !== undefined) patch.isActive = input.isActive;

  if (input.fleetSizeMin !== undefined || input.fleetSizeMax !== undefined) {
    const min =
      input.fleetSizeMin !== undefined
        ? input.fleetSizeMin
        : (current as unknown as { fleetSizeMin: number }).fleetSizeMin;
    const max =
      input.fleetSizeMax !== undefined
        ? input.fleetSizeMax
        : (current as unknown as { fleetSizeMax: number | null }).fleetSizeMax;
    const bounds = normalizeBounds(min, max);
    patch.fleetSizeMin = bounds.fleetSizeMin;
    patch.fleetSizeMax = bounds.fleetSizeMax;
  }
  if (input.perVehiclePerMonth !== undefined) {
    if (input.perVehiclePerMonth < 0) {
      throw new BadRequestError("Per-vehicle monthly rate cannot be negative");
    }
    patch.perVehiclePerMonth = input.perVehiclePerMonth;
  }
  if (input.perVehiclePerYear !== undefined) {
    if (input.perVehiclePerYear < 0) {
      throw new BadRequestError("Per-vehicle yearly rate cannot be negative");
    }
    patch.perVehiclePerYear = input.perVehiclePerYear;
  }
  if (input.perDriverPerMonth !== undefined) {
    if (input.perDriverPerMonth < 0) {
      throw new BadRequestError("Per-driver monthly rate cannot be negative");
    }
    patch.perDriverPerMonth = input.perDriverPerMonth;
  }
  if (input.customComplianceGroupPerMonth !== undefined) {
    if (input.customComplianceGroupPerMonth < 0) {
      throw new BadRequestError(
        "Custom-compliance per-group monthly rate cannot be negative",
      );
    }
    patch.customComplianceGroupPerMonth = input.customComplianceGroupPerMonth;
  }
  if (input.customComplianceDocsPerGroupLimit !== undefined) {
    const n = input.customComplianceDocsPerGroupLimit;
    if (!Number.isInteger(n) || n < 1 || n > 1000) {
      throw new BadRequestError(
        "Documents-per-group limit must be a whole number between 1 and 1000",
      );
    }
    patch.customComplianceDocsPerGroupLimit = n;
  }
  if (input.gstPercent !== undefined) {
    if (input.gstPercent < 0 || input.gstPercent > 100) {
      throw new BadRequestError("GST percent must be between 0 and 100");
    }
    patch.gstPercent = input.gstPercent;
  }

  return planRepo.update(id, patch);
}

export async function deactivatePlan(id: string) {
  const current = await planRepo.findById(id);
  if (!current) throw new NotFoundError("Plan not found");
  if (!current.isActive) {
    throw new ForbiddenError("Plan is already inactive");
  }
  return planRepo.update(id, { isActive: false });
}

export async function reactivatePlan(id: string) {
  const current = await planRepo.findById(id);
  if (!current) throw new NotFoundError("Plan not found");
  if (current.isActive) {
    throw new ForbiddenError("Plan is already active");
  }
  return planRepo.update(id, { isActive: true });
}

/**
 * Auto-tier resolver: returns the active plan whose fleet-size band covers
 * the given vehicle count. If multiple bands match, the one with the smallest
 * range wins (more specific). Returns null when no active plan covers the
 * size — typically means the superadmin hasn't created plans yet.
 */
export async function resolvePlanForFleetSize(vehicleCount: number) {
  const count = Math.max(0, Math.floor(vehicleCount));
  const candidates = await Plan.find({
    isActive: true,
    fleetSizeMin: { $lte: count },
    $or: [
      { fleetSizeMax: null },
      { fleetSizeMax: { $gte: count } },
    ],
  }).lean();
  if (candidates.length === 0) return null;
  // Prefer the tier with the smallest (most specific) max bound.
  candidates.sort((a, b) => {
    const aMax =
      (a as { fleetSizeMax?: number | null }).fleetSizeMax ?? Number.POSITIVE_INFINITY;
    const bMax =
      (b as { fleetSizeMax?: number | null }).fleetSizeMax ?? Number.POSITIVE_INFINITY;
    return aMax - bMax;
  });
  return candidates[0];
}
