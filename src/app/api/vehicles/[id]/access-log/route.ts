import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import * as logRepo from "@/server/repositories/vehiclePublicAccessLog.repository";

export const runtime = "nodejs";

export const GET = withRoute<{ id: string }>(
  async ({ params }) => {
    const entries = await logRepo.findByVehicle(params.id);
    return success(entries, "Vehicle public access log fetched");
  },
  { auth: true },
);
