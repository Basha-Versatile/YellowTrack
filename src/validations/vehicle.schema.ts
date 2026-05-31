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

export type OnboardVehicleInput = z.infer<typeof onboardVehicleSchema>;
export type ManualOnboardInput = z.infer<typeof manualOnboardSchema>;
export type GetVehiclesQuery = z.infer<typeof getVehiclesQuerySchema>;
