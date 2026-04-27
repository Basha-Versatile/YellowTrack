import { withRoute } from "@/lib/api-handler";
import { created, success } from "@/lib/http";
import { BadRequestError, ConflictError } from "@/lib/errors";
import { firstFile, firstString, parseMultipart } from "@/lib/upload";
import { uploadComplianceDocSchema } from "@/validations/document.schema";
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

export const POST = withRoute<{ id: string }>(
  async ({ req, params }) => {
    const { fields, files } = await parseMultipart(req);
    const input = uploadComplianceDocSchema.parse({
      type: firstString(fields, "type"),
      expiryDate: firstString(fields, "expiryDate"),
      lifetime: firstString(fields, "lifetime"),
    });

    // Reject if an active doc of this type already exists — admin should renew, not duplicate
    const existing = await complianceRepo.findByVehicleId(params.id);
    if (existing.some((d) => d.type === input.type && d.isActive)) {
      throw new ConflictError(
        `A ${input.type} document already exists for this vehicle. Use renew to replace it.`,
      );
    }

    const file = firstFile(files, "document");
    const finalExpiry: Date | null = input.lifetime
      ? null
      : input.expiryDate
        ? input.expiryDate instanceof Date
          ? input.expiryDate
          : new Date(input.expiryDate as string)
        : null;

    if (!input.lifetime && !finalExpiry && !file) {
      throw new BadRequestError("Provide an expiry date, mark as lifetime, or upload a file");
    }

    const doc = await complianceRepo.createOne({
      vehicleId: params.id,
      type: input.type,
      expiryDate: finalExpiry,
      documentUrl: file?.url ?? null,
      status: calculateComplianceStatus(finalExpiry),
      isActive: true,
      lastVerifiedAt: new Date(),
    });
    return created(doc, "Compliance document added");
  },
  { auth: true },
);
