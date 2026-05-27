import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import { updateDriverSchema } from "@/validations/driver.schema";
import {
  getDriverById,
  updateDriver,
} from "@/server/services/driver.service";
import { logFromRequest } from "@/server/services/activityLog.service";

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
    // Snapshot only the fields the patch will touch — keeps the log row
    // small while still letting revert restore the exact prior values.
    const before = await getDriverById(ctx, params.id).catch(() => null);
    const driver = await updateDriver(ctx, params.id, input, {
      name: session?.email ?? "system",
      role: "ADMIN",
    });
    const d = driver as { name?: string };
    const beforeSnapshot = before
      ? Object.fromEntries(
          Object.keys(input as Record<string, unknown>).map((k) => [
            k,
            (before as unknown as Record<string, unknown>)[k] ?? null,
          ]),
        )
      : null;
    await logFromRequest(req, ctx, session, {
      action: "driver.update",
      entityType: "driver",
      entityId: params.id,
      entityLabel: d.name ?? params.id,
      summary: `Updated driver ${d.name ?? params.id}`,
      metadata: input as Record<string, unknown>,
      revertable: Boolean(beforeSnapshot),
      beforeSnapshot,
    });
    return success(driver, "Driver updated successfully");
  },
  { auth: true },
);
