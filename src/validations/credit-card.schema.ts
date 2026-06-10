import { z } from "zod";

const dayOfMonth = z.coerce
  .number()
  .int()
  .min(1, "Day must be between 1 and 31")
  .max(31, "Day must be between 1 and 31");

export const createCreditCardSchema = z.object({
  bankName: z.string().trim().min(1, "Bank name is required").max(60),
  last4: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "Enter the last 4 digits of the card"),
  cardholderName: z
    .string()
    .trim()
    .min(1, "Cardholder name is required")
    .max(80),
  billDayOfMonth: dayOfMonth,
  dueDayOfMonth: dayOfMonth,
  // Optional opening amount for the current statement. Operator usually fills
  // this in later via the edit/amount flow.
  currentBillAmount: z.coerce.number().min(0).max(100_000_000).optional(),
});

// All fields optional — used for the edit modal and the "update this month's
// bill amount" flow. Bill/due day stay editable (the operator can correct a
// typo) but they still recur monthly once set.
export const updateCreditCardSchema = z
  .object({
    bankName: z.string().trim().min(1).max(60).optional(),
    last4: z
      .string()
      .trim()
      .regex(/^\d{4}$/, "Enter the last 4 digits of the card")
      .optional(),
    cardholderName: z.string().trim().min(1).max(80).optional(),
    billDayOfMonth: dayOfMonth.optional(),
    dueDayOfMonth: dayOfMonth.optional(),
    currentBillAmount: z.coerce.number().min(0).max(100_000_000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "No fields to update",
  });

export const updateCreditCardSettingsSchema = z.object({
  // Personal WhatsApp number reminders are sent to. Empty string clears it.
  alertWhatsapp: z
    .string()
    .trim()
    .max(20)
    .regex(/^\+?\d{6,15}$/, "Enter a valid phone number")
    .or(z.literal(""))
    .nullable(),
});

export type CreateCreditCardInput = z.infer<typeof createCreditCardSchema>;
export type UpdateCreditCardInput = z.infer<typeof updateCreditCardSchema>;
export type UpdateCreditCardSettingsInput = z.infer<
  typeof updateCreditCardSettingsSchema
>;
