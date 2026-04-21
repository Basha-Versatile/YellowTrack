import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import * as complianceRepo from "@/server/repositories/compliance.repository";
import {
  calculateComplianceStatus,
  daysUntilExpiry,
} from "@/server/services/compliance.service";

export const runtime = "nodejs";

export const GET = withRoute<{ id: string }>(
  async ({ params }) => {
    const docs = await complianceRepo.findByVehicleId(params.id);
    const enriched = docs.map((d) => ({
      ...d,
      status: calculateComplianceStatus(d.expiryDate),
      daysUntilExpiry: daysUntilExpiry(d.expiryDate),
    }));
    return success(enriched, "Compliance documents fetched");
  },
  { auth: true },
);
