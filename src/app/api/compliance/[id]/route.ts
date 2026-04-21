import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { uploadComplianceDocSchema } from "@/validations/document.schema";
import * as complianceRepo from "@/server/repositories/compliance.repository";
import { calculateComplianceStatus } from "@/server/services/compliance.service";

export const runtime = "nodejs";

export const PUT = withRoute<{ id: string }>(
  async ({ req, params }) => {
    const input = await parseJson(req, uploadComplianceDocSchema);
    const rawExpiry = input.lifetime ? null : (input.expiryDate as Date | string | null | undefined);
    const finalExpiry: Date | null = !rawExpiry
      ? null
      : rawExpiry instanceof Date
        ? rawExpiry
        : new Date(rawExpiry);
    const status = calculateComplianceStatus(finalExpiry);
    const doc = await complianceRepo.updateExpiry(params.id, finalExpiry, status);
    return success(doc, "Compliance document updated successfully");
  },
  { auth: true },
);
