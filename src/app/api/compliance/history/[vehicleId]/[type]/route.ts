import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import * as complianceRepo from "@/server/repositories/compliance.repository";

export const runtime = "nodejs";

export const GET = withRoute<{ vehicleId: string; type: string }>(
  async ({ params, session }) => {
    const ctx = tenantOf(session);
    const history = await complianceRepo.getHistory(
      ctx,
      params.vehicleId,
      params.type,
    );
    return success(history, "Document history fetched");
  },
  { auth: true },
);
