import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import * as complianceRepo from "@/server/repositories/compliance.repository";

export const runtime = "nodejs";

export const GET = withRoute<{ vehicleId: string; type: string }>(
  async ({ params }) => {
    const history = await complianceRepo.getHistory(params.vehicleId, params.type);
    return success(history, "Document history fetched");
  },
  { auth: true },
);
