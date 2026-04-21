import { withRoute, parseJson } from "@/lib/api-handler";
import { success, created } from "@/lib/http";
import { createGroupSchema } from "@/validations/vehicleGroup.schema";
import * as service from "@/server/services/vehicleGroup.service";

export const runtime = "nodejs";

export const GET = withRoute(
  async () => {
    return success(await service.getAll(), "Vehicle groups fetched");
  },
  { auth: true },
);

export const POST = withRoute(
  async ({ req }) => {
    const input = await parseJson(req, createGroupSchema);
    return created(await service.create(input), "Vehicle group created");
  },
  { auth: true },
);
