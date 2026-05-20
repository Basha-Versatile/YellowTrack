import { withRoute, parseJson } from "@/lib/api-handler";
import { success, created } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import { createDriverSchema } from "@/validations/driver.schema";
import {
  createDriver,
  getAllDrivers,
} from "@/server/services/driver.service";
import { logFromRequest } from "@/server/services/activityLog.service";

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
    const d = driver as unknown as { id?: unknown; _id?: unknown; name?: string };
    await logFromRequest(req, ctx, session, {
      action: "driver.create",
      entityType: "driver",
      entityId: String(d.id ?? d._id ?? ""),
      entityLabel: d.name ?? input.name,
      summary: `Created driver ${d.name ?? input.name}`,
    });
    return created(driver, "Driver created successfully");
  },
  { auth: true },
);
