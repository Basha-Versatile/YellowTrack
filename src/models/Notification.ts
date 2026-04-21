import "server-only";
import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

// Legacy/runtime type palette. Kept as a non-enforced palette (frontend references these,
// but the DB column is free-form String to match legacy Prisma behavior and allow new
// notification types without schema migrations).
export const NOTIFICATION_TYPES = [
  "DOCUMENT_EXPIRY",
  "VEHICLE_DOC_EXPIRY",
  "DRIVER_DOC_EXPIRY",
  "CHALLAN_NEW",
  "CHALLAN_PAID",
  "LICENSE_EXPIRY",
  "ASSIGNMENT",
  "SYSTEM",
  "DRIVER_SELF_VERIFIED",
  "FASTAG_LOW_BALANCE",
  "SERVICE_DUE",
  "INSURANCE_EXPIRY",
] as const;

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // Free-form string (NO enum) — matches legacy Prisma schema & supports future types
    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    entityId: { type: String },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ createdAt: -1 });

export type NotificationAttrs = InferSchemaType<typeof notificationSchema>;

export const Notification: Model<NotificationAttrs> =
  (models.Notification as Model<NotificationAttrs>) ??
  model<NotificationAttrs>("Notification", notificationSchema);
