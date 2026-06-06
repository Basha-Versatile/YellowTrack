import "server-only";
import { Plan, PlanUpgradeRequest, Tenant, Vehicle } from "@/models";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "@/lib/errors";
import { resolvePlanForFleetSize } from "./plan.service";

const REQUEST_TTL_DAYS = 14;

/**
 * Single source of truth for "what tier should this tenant be on?". Looks
 * at the fleet size and consults the existing resolver. Returns:
 *   - currentPlanId: what's stored on the Tenant doc (may be null)
 *   - suggestedPlanId: what the resolver picks for the live fleet count
 *   - isUpgrade: true when suggested fleetSizeMin > current's fleetSizeMin
 *     (so a higher-priced tier — requires admin confirmation)
 */
export async function evaluatePlanFit(tenantId: string): Promise<{
  currentPlan: { id: string; fleetSizeMin: number } | null;
  suggestedPlan: { id: string; fleetSizeMin: number } | null;
  vehicleCount: number;
  isUpgrade: boolean;
  isDowngrade: boolean;
}> {
  const tenant = await Tenant.findById(tenantId).select("planId").lean();
  const currentPlanId = (tenant as { planId?: unknown } | null)?.planId ?? null;
  const vehicleCount = await Vehicle.countDocuments({
    tenantId,
    status: { $ne: "SOLD" },
  });
  const [currentPlan, suggestedPlan] = await Promise.all([
    currentPlanId
      ? Plan.findById(currentPlanId).select("_id fleetSizeMin").lean()
      : Promise.resolve(null),
    resolvePlanForFleetSize(vehicleCount),
  ]);
  const cp = currentPlan
    ? {
        id: String((currentPlan as { _id: unknown })._id),
        fleetSizeMin: (currentPlan as { fleetSizeMin?: number }).fleetSizeMin ?? 0,
      }
    : null;
  const sp = suggestedPlan
    ? {
        id: String((suggestedPlan as { _id: unknown })._id),
        fleetSizeMin: (suggestedPlan as { fleetSizeMin?: number }).fleetSizeMin ?? 0,
      }
    : null;
  let isUpgrade = false;
  let isDowngrade = false;
  if (cp && sp && cp.id !== sp.id) {
    if (sp.fleetSizeMin > cp.fleetSizeMin) isUpgrade = true;
    else if (sp.fleetSizeMin < cp.fleetSizeMin) isDowngrade = true;
  }
  return { currentPlan: cp, suggestedPlan: sp, vehicleCount, isUpgrade, isDowngrade };
}

/**
 * Create a pending upgrade request — used by the cron and the on-onboard
 * hook. Idempotent: if a PENDING row already exists for this tenant +
 * destination plan, this is a no-op (returns the existing row).
 */
export async function createUpgradeRequest(input: {
  tenantId: string;
  fromPlanId: string | null;
  toPlanId: string;
  vehicleCountAtTrigger: number;
}): Promise<{ id: string; created: boolean }> {
  const existing = await PlanUpgradeRequest.findOne({
    tenantId: input.tenantId,
    status: "PENDING",
  }).lean();
  if (existing) {
    const ex = existing as unknown as { _id: unknown; toPlanId: unknown };
    if (String(ex.toPlanId) === input.toPlanId) {
      return { id: String(ex._id), created: false };
    }
    // Different target — supersede the old request.
    await PlanUpgradeRequest.updateOne(
      { _id: ex._id },
      { $set: { status: "EXPIRED", decidedAt: new Date() } },
    );
  }
  const expiresAt = new Date(
    Date.now() + REQUEST_TTL_DAYS * 24 * 60 * 60 * 1000,
  );
  const row = await PlanUpgradeRequest.create({
    tenantId: input.tenantId,
    fromPlanId: input.fromPlanId,
    toPlanId: input.toPlanId,
    vehicleCountAtTrigger: input.vehicleCountAtTrigger,
    expiresAt,
  });
  return { id: String((row as { _id: unknown })._id), created: true };
}

/**
 * Admin (or any tenant user with billing rights) confirms / rejects a
 * pending upgrade. On APPROVED the tenant's planId is updated and the
 * change is reflected in the next monthly bill.
 */
export async function decideUpgradeRequest(input: {
  requestId: string;
  tenantId: string;
  decidedBy: string;
  decision: "APPROVED" | "REJECTED";
}): Promise<{ status: "APPROVED" | "REJECTED"; planId: string | null }> {
  const req = await PlanUpgradeRequest.findOne({
    _id: input.requestId,
    tenantId: input.tenantId,
  });
  if (!req) throw new NotFoundError("Upgrade request not found");
  const r = req as unknown as {
    _id: unknown;
    status: string;
    toPlanId: unknown;
    expiresAt: Date;
  };
  if (r.status !== "PENDING") {
    throw new ForbiddenError(
      `This upgrade request is already ${r.status.toLowerCase()}`,
    );
  }
  if (r.expiresAt.getTime() < Date.now()) {
    await PlanUpgradeRequest.updateOne(
      { _id: r._id },
      { $set: { status: "EXPIRED", decidedAt: new Date() } },
    );
    throw new BadRequestError(
      "This upgrade request has expired. The system will create a new one on the next plan-fit check.",
    );
  }

  await PlanUpgradeRequest.updateOne(
    { _id: r._id },
    {
      $set: {
        status: input.decision,
        decidedBy: input.decidedBy,
        decidedAt: new Date(),
      },
    },
  );

  if (input.decision === "APPROVED") {
    await Tenant.updateOne(
      { _id: input.tenantId },
      { $set: { planId: r.toPlanId } },
    );
    return { status: "APPROVED", planId: String(r.toPlanId) };
  }
  return { status: "REJECTED", planId: null };
}

/**
 * Cron-side cleanup — expires any PENDING requests past their TTL so the
 * next plan-fit check can recreate them. Returns the number of rows
 * touched for logging.
 */
export async function expireOverdueRequests(): Promise<number> {
  const res = await PlanUpgradeRequest.updateMany(
    { status: "PENDING", expiresAt: { $lt: new Date() } },
    { $set: { status: "EXPIRED", decidedAt: new Date() } },
  );
  return res.modifiedCount ?? 0;
}
