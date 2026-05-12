import { withRoute, parseJson } from "@/lib/api-handler";
import { success, created } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import { createDriverSchema } from "@/validations/driver.schema";
import {
  createDriver,
  getAllDrivers,
} from "@/server/services/driver.service";

export const runtime = "nodejs";

export const GET = withRoute(
  async ({ session }) => {
    const ctx = tenantOf(session);
    const drivers = await getAllDrivers(ctx);
    return success(drivers, "Drivers fetched successfully");
  },
  { auth: true },
);

export const POST = withRoute(
  async ({ req, session }) => {
    const ctx = tenantOf(session);
    const input = await parseJson(req, createDriverSchema);
    const driver = await createDriver(ctx, input);
    return created(driver, "Driver created successfully");
  },
  { auth: true },
);
