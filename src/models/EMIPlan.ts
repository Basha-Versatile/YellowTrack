import "server-only";
import {
  Schema,
  model,
  models,
  type Model,
  type InferSchemaType,
} from "mongoose";

export const EMI_STATUSES = [
  "ACTIVE",
  "CLOSED",
  "DEFAULTED",
  "PAUSED",
] as const;

export const LENDER_TYPES = ["BANK", "NBFC", "PARTNER"] as const;

export const REMINDER_CHANNELS = ["EMAIL", "WHATSAPP", "IN_APP"] as const;

const emiPlanSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    vehicleId: {
      type: Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true,
      index: true,
    },

    lenderName: { type: String, required: true, trim: true, maxlength: 120 },
    lenderType: {
      type: String,
      enum: LENDER_TYPES,
      default: "BANK",
    },
    lenderContactPhone: { type: String, trim: true, default: null },
    lenderBranch: { type: String, trim: true, default: null },

    debitBankName: { type: String, trim: true, default: null },
    debitAccountMasked: { type: String, trim: true, default: null },
    debitAccountHolder: { type: String, trim: true, default: null },

    principalAmount: { type: Number, min: 0, default: null },
    emiAmount: { type: Number, required: true, min: 0 },
    totalInstallments: { type: Number, required: true, min: 1, max: 600 },
    paidInstallments: { type: Number, default: 0, min: 0 },

    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    dueDayOfMonth: { type: Number, required: true, min: 1, max: 31 },

    status: {
      type: String,
      enum: EMI_STATUSES,
      default: "ACTIVE",
      index: true,
    },
    nextDueDate: { type: Date, index: true, default: null },

    reminderChannels: {
      type: [{ type: String, enum: REMINDER_CHANNELS }],
      default: ["EMAIL", "IN_APP"],
    },
    reminderLeadDays: {
      type: [Number],
      default: [7, 3, 1],
      validate: {
        validator: (arr: number[]) =>
          Array.isArray(arr) && arr.every((n) => Number.isInteger(n) && n >= 0 && n <= 60),
        message: "reminderLeadDays must be integers between 0 and 60",
      },
    },

    notes: { type: String, trim: true, default: null, maxlength: 500 },

    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

emiPlanSchema.index({ tenantId: 1, vehicleId: 1, status: 1 });
emiPlanSchema.index({ tenantId: 1, status: 1, nextDueDate: 1 });

export type EMIPlanAttrs = InferSchemaType<typeof emiPlanSchema>;

export const EMIPlan: Model<EMIPlanAttrs> =
  (models.EMIPlan as Model<EMIPlanAttrs>) ??
  model<EMIPlanAttrs>("EMIPlan", emiPlanSchema);
