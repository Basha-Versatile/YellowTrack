import "server-only";
import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

// Coarse entity categories the log is keyed by — kept enum-like so the UI
// can offer reliable filters. Extend additively; never rename existing values
// without a migration since the log is permanent (no TTL).
export const ACTIVITY_ENTITY_TYPES = [
  "auth",
  "vehicle",
  "driver",
  "compliance",
  "user",
  "role",
  "emi",
  "expense",
  "document_type",
  "vehicle_group",
  "tyre_replacement",
  "fastag",
  "challan",
  "service_record",
  "vehicle_sale",
  "customComplianceGroup",
  "customComplianceDocument",
  "tenant",
] as const;

export type ActivityEntityType = (typeof ACTIVITY_ENTITY_TYPES)[number];

const fieldDiffSchema = new Schema(
  {
    field: { type: String, required: true },
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
  },
  { _id: false },
);

const activityLogSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },

    // Actor snapshot — copied at write time so future renames / role changes /
    // user deletes don't rewrite history.
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    userName: { type: String, default: null },
    userEmail: { type: String, default: null },
    userRole: { type: String, default: null },

    // Action key in the form "<entity>.<verb>" — e.g. "vehicle.create",
    // "compliance.renew", "user.suspend". UI never parses this; it's a stable
    // identifier for filtering + analytics.
    action: { type: String, required: true, index: true },

    entityType: { type: String, enum: ACTIVITY_ENTITY_TYPES, required: true, index: true },
    entityId: { type: String, default: null },
    // Human-readable handle for the entity (reg no, driver name, doc type)
    // so the log reads cleanly even after the underlying record is renamed
    // or deleted.
    entityLabel: { type: String, default: null },

    summary: { type: String, required: true },
    fields: { type: [fieldDiffSchema], default: [] },
    metadata: { type: Schema.Types.Mixed, default: null },

    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },

    // ── Revert support ─────────────────────────────────────────────────────
    // `revertable` is set to true at capture time when we have enough data
    // (a beforeSnapshot for updates/deletes, or a createdSnapshot for creates)
    // to undo this action. UI hides the revert button when false.
    revertable: { type: Boolean, default: false, index: true },
    // Entity state *before* the mutation — populated for updates and deletes.
    beforeSnapshot: { type: Schema.Types.Mixed, default: null },
    // What got created — populated for creates, lets revert identify the row.
    createdSnapshot: { type: Schema.Types.Mixed, default: null },
    // For deletes that cascade, snapshots of the cascaded children grouped by
    // model name, e.g. { ComplianceDocument: [...], Expense: [...] }.
    childSnapshots: { type: Schema.Types.Mixed, default: null },
    // Set when this entry has been undone. `revertedFromActivityId` is the
    // back-pointer on a `*.revert` entry → the original it undid.
    revertedAt: { type: Date, default: null },
    revertedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    revertedFromActivityId: {
      type: Schema.Types.ObjectId,
      ref: "ActivityLog",
      default: null,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

activityLogSchema.index({ tenantId: 1, createdAt: -1 });
activityLogSchema.index({ tenantId: 1, entityType: 1, createdAt: -1 });
activityLogSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });

export type ActivityLogAttrs = InferSchemaType<typeof activityLogSchema>;

// In Next.js dev mode, route files hot-reload but Mongoose's global model
// registry persists — so a schema change here would silently drop new fields
// on insert until the dev server is restarted. Force re-registration in dev
// so schema edits to revert-snapshot fields take effect on save.
if (process.env.NODE_ENV !== "production" && models.ActivityLog) {
  delete models.ActivityLog;
}

export const ActivityLog: Model<ActivityLogAttrs> =
  (models.ActivityLog as Model<ActivityLogAttrs>) ??
  model<ActivityLogAttrs>("ActivityLog", activityLogSchema);
