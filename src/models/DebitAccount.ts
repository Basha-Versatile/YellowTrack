import "server-only";
import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

/**
 * Tenant-scoped catalog of debit bank accounts the tenant uses for EMI
 * autopay. Each EMI plan references one of these by storing the same
 * `bankName + accountMasked` triple, but the catalog also lives here so the
 * "New EMI plan" form can offer a dropdown instead of asking the user to
 * retype every time.
 *
 * Uniqueness is (tenantId, bankName, accountMasked) — two entries for the
 * same masked number under the same bank are collapsed into one.
 */
const debitAccountSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    bankName: { type: String, required: true, trim: true, maxlength: 120 },
    accountHolder: { type: String, trim: true, default: null, maxlength: 120 },
    accountMasked: { type: String, required: true, trim: true, maxlength: 64 },
    branch: { type: String, trim: true, default: null, maxlength: 120 },
    notes: { type: String, trim: true, default: null, maxlength: 240 },
    lastUsedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

debitAccountSchema.index(
  { tenantId: 1, bankName: 1, accountMasked: 1 },
  { unique: true },
);

export type DebitAccountAttrs = InferSchemaType<typeof debitAccountSchema>;

if (process.env.NODE_ENV !== "production" && models.DebitAccount) {
  delete models.DebitAccount;
}

export const DebitAccount: Model<DebitAccountAttrs> =
  (models.DebitAccount as Model<DebitAccountAttrs>) ??
  model<DebitAccountAttrs>("DebitAccount", debitAccountSchema);
