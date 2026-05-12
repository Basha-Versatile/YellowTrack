import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import { updateDriverSchema } from "@/validations/driver.schema";
import {
  getDriverById,
  updateDriver,
} from "@/server/services/driver.service";

export const runtime = "nodejs";

export const GET = withRoute<{ id: string }>(
  async ({ params, session }) => {
    const ctx = tenantOf(session);
    const driver = await getDriverById(ctx, params.id);
    return success(driver, "Driver fetched successfully");
  },
  { auth: true },
);

export const PUT = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    const ctx = tenantOf(session);
    const input = await parseJson(req, updateDriverSchema);
    const driver = await updateDriver(ctx, params.id, input, {
      name: session?.email ?? "system",
      role: "ADMIN",
    });
    return success(driver, "Driver updated successfully");
  },
  { auth: true },
);
