import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import { updateGroupSchema } from "@/validations/vehicleGroup.schema";
import * as service from "@/server/services/vehicleGroup.service";

export const runtime = "nodejs";

export const GET = withRoute<{ id: string }>(
  async ({ params, session }) => {
    const ctx = tenantOf(session);
    return success(await service.getById(ctx, params.id), "Vehicle group fetched");
  },
  { auth: true },
);

export const PUT = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    const ctx = tenantOf(session);
    const input = await parseJson(req, updateGroupSchema);
    return success(
      await service.update(ctx, params.id, input),
      "Vehicle group updated",
    );
  },
  { auth: true },
);

export const DELETE = withRoute<{ id: string }>(
  async ({ params, session }) => {
    const ctx = tenantOf(session);
    await service.remove(ctx, params.id);
    return success(null, "Vehicle group deleted");
  },
  { auth: true },
);
