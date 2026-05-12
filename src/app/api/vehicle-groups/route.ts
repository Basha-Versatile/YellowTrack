import { withRoute, parseJson } from "@/lib/api-handler";
import { success, created } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import { createGroupSchema } from "@/validations/vehicleGroup.schema";
import * as service from "@/server/services/vehicleGroup.service";

export const runtime = "nodejs";

export const GET = withRoute(
  async ({ session }) => {
    const ctx = tenantOf(session);
    return success(await service.getAll(ctx), "Vehicle groups fetched");
  },
  { auth: true },
);

export const POST = withRoute(
  async ({ req, session }) => {
    const ctx = tenantOf(session);
    const input = await parseJson(req, createGroupSchema);
    return created(await service.create(ctx, input), "Vehicle group created");
  },
  { auth: true },
);
