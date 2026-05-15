import "server-only";
import { Types } from "mongoose";
import { EMIPlan, EMIPayment, Vehicle } from "@/models";
import {
  type ScopedContext,
  tenantFilter,
  tenantStamp,
} from "@/lib/auth/tenant-context";

// ── EMIPlan ────────────────────────────────────────────────────────────────

export async function findAllPlans(
  ctx: ScopedContext,
  filters: { status?: string; vehicleId?: string } = {},
) {
  const extras: Record<string, unknown> = {};
  if (filters.status) extras.status = filters.status;
  if (filters.vehicleId) extras.vehicleId = filters.vehicleId;
  return EMIPlan.find(tenantFilter(ctx, extras))
    .sort({ status: 1, nextDueDate: 1, createdAt: -1 })
    .lean();
}

export async function findPlanById(ctx: ScopedContext, id: string) {
  return EMIPlan.findOne(tenantFilter(ctx, { _id: id })).lean();
}

export async function findActivePlanByVehicleId(
  ctx: ScopedContext,
  vehicleId: string,
) {
  return EMIPlan.findOne(
    tenantFilter(ctx, { vehicleId, status: "ACTIVE" }),
  ).lean();
}

export async function findPlansByVehicleId(
  ctx: ScopedContext,
  vehicleId: string,
) {
  return EMIPlan.find(tenantFilter(ctx, { vehicleId }))
    .sort({ status: 1, createdAt: -1 })
    .lean();
}

export async function createPlan(
  ctx: ScopedContext,
  data: Record<string, unknown>,
) {
  return EMIPlan.create({ ...tenantStamp(ctx), ...data });
}

export async function updatePlan(
  ctx: ScopedContext,
  id: string,
  patch: Record<string, unknown>,
) {
  return EMIPlan.findOneAndUpdate(
    tenantFilter(ctx, { _id: id }),
    { $set: patch },
    { new: true },
  ).lean();
}

export async function incrementPaidInstallments(
  ctx: ScopedContext,
  id: string,
  by = 1,
) {
  return EMIPlan.findOneAndUpdate(
    tenantFilter(ctx, { _id: id }),
    { $inc: { paidInstallments: by } },
    { new: true },
  ).lean();
}

// ── EMIPayment ─────────────────────────────────────────────────────────────

export async function findPaymentsByPlan(
  ctx: ScopedContext,
  emiPlanId: string,
) {
  return EMIPayment.find(tenantFilter(ctx, { emiPlanId }))
    .sort({ installmentNumber: 1 })
    .lean();
}

export async function findPaymentById(ctx: ScopedContext, id: string) {
  return EMIPayment.findOne(tenantFilter(ctx, { _id: id })).lean();
}

export async function insertManyPayments(
  ctx: ScopedContext,
  rows: Array<Record<string, unknown>>,
) {
  const stamp = tenantStamp(ctx);
  return EMIPayment.insertMany(rows.map((r) => ({ ...stamp, ...r })));
}

export async function updatePayment(
  ctx: ScopedContext,
  id: string,
  patch: Record<string, unknown>,
) {
  return EMIPayment.findOneAndUpdate(
    tenantFilter(ctx, { _id: id }),
    { $set: patch },
    { new: true },
  ).lean();
}

// Find the next un-paid scheduled installment for a plan (lowest installment#).
export async function findNextScheduledPayment(
  ctx: ScopedContext,
  emiPlanId: string,
) {
  return EMIPayment.findOne(
    tenantFilter(ctx, {
      emiPlanId,
      status: { $in: ["SCHEDULED", "OVERDUE", "BOUNCED"] },
    }),
  )
    .sort({ installmentNumber: 1 })
    .lean();
}

// Cross-vehicle hub aggregation: plans with vehicle registration + computed
// upcoming due fields.
export async function findHubRows(
  ctx: ScopedContext,
  filters: { statuses?: string[]; dueWithinDays?: number | null } = {},
) {
  const match: Record<string, unknown> = {};
  if (filters.statuses && filters.statuses.length > 0) {
    match.status = { $in: filters.statuses };
  }
  if (filters.dueWithinDays != null) {
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + filters.dueWithinDays);
    match.nextDueDate = { $lte: horizon };
  }
  const plans = await EMIPlan.find(tenantFilter(ctx, match))
    .sort({ nextDueDate: 1, createdAt: -1 })
    .lean();

  if (plans.length === 0) return [];

  const vehicleIds = [
    ...new Set(plans.map((p) => String(p.vehicleId))),
  ].map((id) => new Types.ObjectId(id));
  const vehicles = await Vehicle.find(
    tenantFilter(ctx, { _id: { $in: vehicleIds } }),
  )
    .select("_id registrationNumber make model")
    .lean();
  const byId = new Map(vehicles.map((v) => [String(v._id), v]));

  return plans.map((p) => ({
    ...p,
    vehicle: byId.get(String(p.vehicleId)) ?? null,
  }));
}

export async function countByStatus(ctx: ScopedContext) {
  const rows = await EMIPlan.aggregate([
    { $match: tenantFilter(ctx, {}) },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const map: Record<string, number> = {};
  for (const r of rows) map[String(r._id)] = r.count as number;
  return map;
}

export async function sumMonthlyOutflow(ctx: ScopedContext) {
  const rows = await EMIPlan.aggregate([
    { $match: tenantFilter(ctx, { status: "ACTIVE" }) },
    { $group: { _id: null, total: { $sum: "$emiAmount" } } },
  ]);
  return rows[0]?.total ?? 0;
}
