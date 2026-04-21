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
});

export const POST = withRoute(
  async ({ req }) => {
    const { licenseNumber } = await parseJson(req, bodySchema);
    const driver = await autoCreateDriver(licenseNumber);
    return created(driver, "Driver verified and created successfully");
  },
  { auth: true },
);
