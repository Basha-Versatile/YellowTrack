import "server-only";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/lib/errors";
import * as planRepo from "../repositories/plan.repository";

export type PlanInput = {
  name: string;
  description?: string | null;
  price: number;
  currency?: string;
  durationDays: number;
  isActive?: boolean;
  maxVehicles?: number | null;
  maxDrivers?: number | null;
  maxUsers?: number | null;
  maxRoles?: number | null;
};

const QUOTA_KEYS = ["maxVehicles", "maxDrivers", "maxUsers", "maxRoles"] as const;
type QuotaKey = (typeof QUOTA_KEYS)[number];

function normalizeQuota(val: number | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  if (!Number.isFinite(val) || val < 0) return null;
  return Math.floor(val);
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
  if (input.price < 0) throw new BadRequestError("Price cannot be negative");
  if (input.durationDays < 1)
    throw new BadRequestError("Duration must be at least 1 day");

  const dup = await planRepo.findByName(name);
  if (dup) throw new ConflictError("A plan with this name already exists");

  return planRepo.create({
    name,
    description: input.description?.trim() ?? null,
    price: input.price,
    currency: (input.currency ?? "INR").toUpperCase(),
    durationDays: input.durationDays,
    isActive: input.isActive ?? true,
    maxVehicles: normalizeQuota(input.maxVehicles),
    maxDrivers: normalizeQuota(input.maxDrivers),
    maxUsers: normalizeQuota(input.maxUsers),
    maxRoles: normalizeQuota(input.maxRoles),
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
  if (input.price !== undefined) {
    if (input.price < 0) throw new BadRequestError("Price cannot be negative");
    patch.price = input.price;
  }
  if (input.currency !== undefined) {
    patch.currency = input.currency.toUpperCase();
  }
  if (input.durationDays !== undefined) {
    if (input.durationDays < 1)
      throw new BadRequestError("Duration must be at least 1 day");
    patch.durationDays = input.durationDays;
  }
  if (input.isActive !== undefined) patch.isActive = input.isActive;

  for (const key of QUOTA_KEYS) {
    const val = (input as Record<QuotaKey, number | null | undefined>)[key];
    if (val !== undefined) patch[key] = normalizeQuota(val);
  }

  return planRepo.update(id, patch);
}

export async function deactivatePlan(id: string) {
  const current = await planRepo.findById(id);
  if (!current) throw new NotFoundError("Plan not found");
  if (!current.isActive) {
    throw new ForbiddenError("Plan is already inactive");
  }
  // Deactivation is safe even with active tenants — they keep their plan until
  // it expires; new tenants just can't pick it.
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
