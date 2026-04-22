import { withRoute, parseJson } from "@/lib/api-handler";
import { created } from "@/lib/http";
import { z } from "zod";
import { autoCreateDriver } from "@/server/services/driver.service";

export const runtime = "nodejs";

const bodySchema = z.object({
  licenseNumber: z
    .string()
    .min(5, "Valid license number is required")
    .transform((v) => v.toUpperCase().replace(/\s/g, "")),
  // YYYY-MM-DD — required for the real Surepass DL endpoint, optional locally
  // so the mock fallback (dev) still works without a DOB.
  dob: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "DOB must be YYYY-MM-DD")
    .optional(),
});

export const POST = withRoute(
  async ({ req }) => {
    const { licenseNumber, dob } = await parseJson(req, bodySchema);
    const driver = await autoCreateDriver(licenseNumber, dob);
    return created(driver, "Driver verified and created successfully");
  },
  { auth: true },
);
