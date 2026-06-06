import "server-only";
import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

export const PLAN_UPGRADE_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
] as const;
export const PLAN_UPGRADE_REASONS = ["fleet_outgrew", "manual_review"] as const;

/**
 * A queued plan upgrade — created automatically when the daily plan-fit
 * check sees a tenant's fleet outgrew its current tier, but held until an
 * admin confirms (or expires after 14 days). On APPROVED, the orchestrator
 * applies the change and writes an activity-log entry.
 *
 * Only one PENDING request per tenant at a time — the plan-fit checker
 * looks for an existing pending row before creating a new one.
 */
const planUpgradeRequestSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    fromPlanId: { type: Schema.Types.ObjectId, ref: "Plan", default: null },
    toPlanId: { type: Schema.Types.ObjectId, ref: "Plan", required: true },
    reason: {
      type: String,
      enum: PLAN_UPGRADE_REASONS,
      default: "fleet_outgrew",
    },
    // Snapshot of fleet size at the moment the request was created — used
    // in the modal/email to explain WHY the upgrade is being suggested.
    vehicleCountAtTrigger: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: PLAN_UPGRADE_STATUSES,
      default: "PENDING",
      index: true,
    },
    decidedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    decidedAt: { type: Date, default: null },
    // Auto-expiry; the daily check resets EXPIRED rows by creating a new
    // PENDING one if the conditions still hold.
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

planUpgradeRequestSchema.index({ tenantId: 1, status: 1 });

export type PlanUpgradeRequestAttrs = InferSchemaType<
  typeof planUpgradeRequestSchema
>;

if (process.env.NODE_ENV !== "production" && models.PlanUpgradeRequest) {
  delete models.PlanUpgradeRequest;
}

export const PlanUpgradeRequest: Model<PlanUpgradeRequestAttrs> =
  (models.PlanUpgradeRequest as Model<PlanUpgradeRequestAttrs>) ??
  model<PlanUpgradeRequestAttrs>(
    "PlanUpgradeRequest",
    planUpgradeRequestSchema,
  );
