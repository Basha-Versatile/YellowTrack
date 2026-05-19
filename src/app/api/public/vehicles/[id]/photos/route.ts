import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { getVehiclePhotosPublic } from "@/server/services/public.service";

export const runtime = "nodejs";

export const GET = withRoute<{ id: string }>(async ({ params }) => {
  return success(await getVehiclePhotosPublic(params.id), "Success");
});
