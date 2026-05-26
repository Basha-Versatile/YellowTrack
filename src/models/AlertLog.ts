import "server-only";
import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

/**
 * Outbound delivery log — every email / WhatsApp dispatch attempt lands here.
 * Distinct from the in-app `Notification` collection (the bell icon).
 *
 * Used for:
 *   - Audit (who got which alert, when, did it succeed)
 *   - Debugging delivery failures
 *   - Dashboard view at /settings/notifications
 */

export const ALERT_CHANNELS = ["email", "whatsapp"] as const;
export const ALERT_STATUS = ["sent", "failed", "skipped"] as const;

const alertLogSchema = new Schema(
  {
    // Tenant scope — superadmin alerts (subscription expiring) leave this null.
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", index: true },
    // Free-form type slug — e.g. "driver_verify_link", "compliance_expiry_alert"
    type: { type: String, required: true, index: true },
    channel: { type: String, enum: ALERT_CHANNELS, required: true, index: true },
    // Comma-separated recipients for emails, single number for WhatsApp.
    to: { type: String, required: true },
    subject: { type: String }, // email only
    status: { type: String, enum: ALERT_STATUS, required: true, index: true },
    // Provider response message ID (Nodemailer `messageId`, ChatBox API id, etc.).
    providerMessageId: { type: String },
    // Error string if status === "failed".
    error: { type: String },
    // Free-form context — entity IDs, days-remaining, etc. — handy for debugging
    // and for the delivery-log dashboard. Kept loose because templates vary.
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

alertLogSchema.index({ tenantId: 1, createdAt: -1 });
alertLogSchema.index({ type: 1, createdAt: -1 });

export type AlertLogAttrs = InferSchemaType<typeof alertLogSchema>;

export const AlertLog: Model<AlertLogAttrs> =
  (models.AlertLog as Model<AlertLogAttrs>) ??
  model<AlertLogAttrs>("AlertLog", alertLogSchema);
