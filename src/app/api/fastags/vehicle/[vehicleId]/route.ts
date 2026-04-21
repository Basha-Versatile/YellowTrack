import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import * as service from "@/server/services/fastag.service";

export const runtime = "nodejs";

export const GET = withRoute<{ vehicleId: string }>(
  async ({ params }) => success(await service.getByVehicle(params.vehicleId), "FASTag fetched"),
  { auth: true },
);
