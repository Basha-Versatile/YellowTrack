import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { updateGroupSchema } from "@/validations/vehicleGroup.schema";
import * as service from "@/server/services/vehicleGroup.service";

export const runtime = "nodejs";

export const GET = withRoute<{ id: string }>(
  async ({ params }) => {
    return success(await service.getById(params.id), "Vehicle group fetched");
  },
  { auth: true },
);

export const PUT = withRoute<{ id: string }>(
  async ({ req, params }) => {
    const input = await parseJson(req, updateGroupSchema);
    return success(
      await service.update(params.id, input),
      "Vehicle group updated",
    );
  },
  { auth: true },
);

export const DELETE = withRoute<{ id: string }>(
  async ({ params }) => {
    await service.remove(params.id);
    return success(null, "Vehicle group deleted");
  },
  { auth: true },
);
