import { z } from "zod";

// Accept groupIds as either a JSON-encoded array (e.g. ["id1","id2"]) or a
// repeated query/form value. The transform normalizes both into string[].
const groupIdsInput = z
  .union([z.array(z.string()), z.string()])
  .optional()
  .nullable()
  .transform((v) => {
    if (v == null) return undefined;
    if (Array.isArray(v)) return v.filter(Boolean);
    const trimmed = v.trim();
    if (!trimmed) return undefined;
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [trimmed];
      } catch {
        return [trimmed];
      }
    }
    return [trimmed];
  });

export const onboardVehicleSchema = z.object({
  registrationNumber: z
    .string()
    .min(4, "Registration number must be at least 4 characters")
    .max(15, "Registration number must be at most 15 characters")
    .transform((val) => val.toUpperCase().replace(/\s/g, "")),
  groupIds: groupIdsInput,
  vehicleUsage: z.enum(["PRIVATE", "COMMERCIAL"]).optional().nullable(),
});

export const getVehiclesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  // Cap kept high enough for the Vehicles page to fetch a fleet-wide
  // snapshot in one shot for the TOTAL / COMPLIANT / EXPIRING / CRITICAL
  // stat cards. Without this, requests at `limit: 10000` failed validation
  // and the cards silently showed 0 even when the list had matches.
  limit: z.coerce.number().int().positive().max(10000).default(10),
  search: z.string().optional(),
  status: z.enum(["GREEN", "YELLOW", "RED"]).optional(),
  groupId: z.string().optional(),
  vehicleUsage: z.enum(["PRIVATE", "COMMERCIAL"]).optional(),
  lifecycle: z.enum(["ACTIVE", "SOLD"]).optional(),
  brand: z.string().optional(),
});

export const manualOnboardSchema = z
  .object({
    registrationNumber: z
      .string()
      .min(4, "Registration number must be at least 4 characters")
      .max(15, "Registration number must be at most 15 characters")
      .transform((val) => val.toUpperCase().replace(/\s/g, "")),
    ownerName: z.string().optional().nullable(),
    make: z.string().min(1, "Make is required"),
    model: z.string().min(1, "Model is required"),
    fuelType: z.string().min(1, "Fuel type is required"),
    chassisNumber: z.string().optional().nullable(),
    engineNumber: z.string().optional().nullable(),
    gvw: z.coerce.number().int().optional().nullable(),
    seatingCapacity: z.coerce.number().int().optional().nullable(),
    permitType: z.string().optional().nullable(),
    vehicleUsage: z.enum(["PRIVATE", "COMMERCIAL"]).optional().nullable(),
    groupIds: groupIdsInput,
  })
  .passthrough(); // allow dynamic doc-expiry fields (e.g. rcExpiry, route_permitExpiry)

// `null` clears the field, `undefined` leaves it untouched. Empty strings
// are treated as "clear it" to match common form behaviour.
const nullableStr = z.preprocess(
  (val) => {
    if (val === undefined) return undefined;
    if (val === null) return null;
    const s = String(val).trim();
    return s.length === 0 ? null : s;
  },
  z.string().nullable().optional(),
);
const nullableInt = z.preprocess(
  (val) => {
    if (val === undefined || val === null || val === "") return val ?? undefined;
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
  },
  z.number().int().nullable().optional(),
);
const nullableDate = z.preprocess(
  (val) => {
    if (val === undefined || val === null) return val ?? undefined;
    const s = String(val).trim();
    return s.length === 0 ? null : new Date(s);
  },
  z.date().nullable().optional(),
);

/**
 * "Edit vehicle details" form payload. Every field is optional — only what
 * the caller sends is touched. `null` actively clears a value; absent means
 * leave alone. registrationNumber is allowed to change (rare but useful for
 * typo fixes) and the service re-runs the tenant-scoped duplicate check.
 */
export const updateVehicleSchema = z
  .object({
    registrationNumber: z
      .string()
      .min(4)
      .max(15)
      .transform((v) => v.toUpperCase().replace(/\s/g, ""))
      .optional(),
    ownerName: nullableStr,
    make: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
    fuelType: z.string().min(1).optional(),
    brand: nullableStr,
    chassisNumber: nullableStr,
    engineNumber: nullableStr,
    gvw: nullableInt,
    seatingCapacity: nullableInt,
    tyreCount: nullableInt,
    permitType: nullableStr,
    vehicleUsage: z.enum(["PRIVATE", "COMMERCIAL"]).nullable().optional(),
    registrationDate: nullableDate,

    // RC / Surepass metadata — editable so users can correct missing or
    // wrong values that came back from the registry lookup.
    rcStatus: nullableStr,
    blacklistStatus: nullableStr,
    financed: z.boolean().nullable().optional(),
    financer: nullableStr,
    ownerNumber: nullableInt,
    registeredAt: nullableStr,
    manufacturingDate: nullableStr,
    ownerPhone: nullableStr,
    ownerAddress: nullableStr,
    fatherName: nullableStr,
    color: nullableStr,
    bodyType: nullableStr,
    vehicleCategory: nullableStr,
    normsType: nullableStr,
    cubicCapacity: nullableStr,
    cylinders: nullableInt,
    wheelbase: nullableInt,
    unladenWeight: nullableInt,
    taxMode: nullableStr,

    groupIds: groupIdsInput,
  })
  .strict();

export type OnboardVehicleInput = z.infer<typeof onboardVehicleSchema>;
export type ManualOnboardInput = z.infer<typeof manualOnboardSchema>;
export type GetVehiclesQuery = z.infer<typeof getVehiclesQuerySchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
