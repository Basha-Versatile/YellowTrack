import "server-only";
import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

/**
 * A user-defined bucket for arbitrary compliance documents that don't belong
 * to a specific vehicle or driver — e.g. a sister company ("Blue Drive
 * Mobility") whose GST, Labour Licence, Partnership Deed need tracking, or a
 * category like "Company Agreements".
 *
 * Documents inside a group each carry their own expiry, so the same dashboard
 * mechanics that surface vehicle compliance drift also work here.
 */
/**
 * Per-user unlock grant. When an operator types the correct lock password,
 * a row is upserted here with a 3-minute `unlockedUntil`. Server-side
 * guards on every read/write to the group check this list.
 *
 * Stored inline on the group doc (not a separate collection) because the
 * cardinality is tiny — at most one row per active user per folder, and
 * stale rows are pruned at every unlock attempt.
 */
const unlockGrantSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    unlockedUntil: { type: Date, required: true },
  },
  { _id: false },
);

/**
 * Brute-force tracking. Stores the timestamps of the last N failed unlock
 * attempts (across the whole tenant — folder-level, not per-user, so a
 * persistent attacker can't reset the counter by rotating users). When the
 * count of recent failures exceeds the threshold within the window, the
 * `blockedUntil` field is set and unlock attempts return 429 until it
 * lapses.
 */
const lockSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    recoveryEmail: { type: String, default: null, lowercase: true, trim: true },
    passwordHash: { type: String, default: null },
    setBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    setAt: { type: Date, default: null },
    // Rolling list of recent failed-unlock timestamps. Capped at 20 by the
    // service layer — only the last 20 are kept, oldest dropped first.
    recentFailures: { type: [Date], default: [] },
    // Set when the folder is rate-limited. Cleared automatically on the
    // next successful unlock.
    blockedUntil: { type: Date, default: null },
    // 60s cooldown between OTP requests. Records when the last OTP for
    // password reset was sent.
    lastOtpRequestedAt: { type: Date, default: null },
  },
  { _id: false },
);

const customComplianceGroupSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, default: null, maxlength: 500 },
    // Display tint used by the group card / chip; falls back to a neutral
    // palette in the UI when null.
    color: { type: String, trim: true, default: null, maxlength: 40 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    // Soft delete — keeps documents queryable for audit if needed, but the
    // group disappears from list/detail screens.
    deletedAt: { type: Date, default: null, index: true },

    // ── Folder-level lock ────────────────────────────────────────────
    // Optional, off by default. Existing groups are unaffected on migration
    // (the field is absent → `lock.enabled` evaluates to undefined → the
    // server-side guard treats the folder as unlocked).
    lock: { type: lockSchema, default: null },
    // Active per-user unlock grants. Length ≤ 50 (we prune stale rows in
    // the service layer so this doesn't grow unbounded).
    unlockedBy: { type: [unlockGrantSchema], default: [] },
  },
  { timestamps: true },
);

// Tenant-scoped uniqueness on name; partial filter so soft-deleted rows don't
// block re-creating a group with the same label.
customComplianceGroupSchema.index(
  { tenantId: 1, name: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);

type GroupQuery = {
  getOptions: () => { includeDeleted?: boolean };
  getFilter: () => Record<string, unknown>;
  where: (cond: Record<string, unknown>) => unknown;
};
function excludeDeleted(this: GroupQuery): void {
  if (this.getOptions().includeDeleted) return;
  const filter = this.getFilter();
  if (Object.prototype.hasOwnProperty.call(filter, "deletedAt")) return;
  this.where({ deletedAt: null });
}
customComplianceGroupSchema.pre(/^find/, excludeDeleted as never);
customComplianceGroupSchema.pre("countDocuments", excludeDeleted as never);

export type CustomComplianceGroupAttrs = InferSchemaType<
  typeof customComplianceGroupSchema
>;

if (process.env.NODE_ENV !== "production" && models.CustomComplianceGroup) {
  delete models.CustomComplianceGroup;
}

export const CustomComplianceGroup: Model<CustomComplianceGroupAttrs> =
  (models.CustomComplianceGroup as Model<CustomComplianceGroupAttrs>) ??
  model<CustomComplianceGroupAttrs>(
    "CustomComplianceGroup",
    customComplianceGroupSchema,
  );
