import { withRoute } from "@/lib/api-handler";
import { created, success } from "@/lib/http";
import { BadRequestError, ConflictError } from "@/lib/errors";
import { firstFile, firstString, parseMultipart } from "@/lib/upload";
import { tenantOf } from "@/lib/auth/tenant-context";
import { uploadComplianceDocSchema } from "@/validations/document.schema";
import * as complianceRepo from "@/server/repositories/compliance.repository";
import {
  calculateComplianceStatus,
  daysUntilExpiry,
} from "@/server/services/compliance.service";
import { logFromRequest } from "@/server/services/activityLog.service";

export const runtime = "nodejs";

export const GET = withRoute<{ id: string }>(
  async ({ params, session }) => {
    const ctx = tenantOf(session);
    const docs = await complianceRepo.findByVehicleId(ctx, params.id);
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
  async ({ req, params, session }) => {
    const ctx = tenantOf(session);
    const { fields, files } = await parseMultipart(req);
    const input = uploadComplianceDocSchema.parse({
      type: firstString(fields, "type"),
      issuedDate: firstString(fields, "issuedDate"),
      expiryDate: firstString(fields, "expiryDate"),
      lifetime: firstString(fields, "lifetime"),
    });

    // Reject if an active doc of this type already exists — admin should renew, not duplicate
    const existing = await complianceRepo.findByVehicleId(ctx, params.id);
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
    const finalIssued: Date | null = input.issuedDate
      ? input.issuedDate instanceof Date
        ? input.issuedDate
        : new Date(input.issuedDate as string)
      : null;

    if (finalIssued && finalExpiry && finalIssued > finalExpiry) {
      throw new BadRequestError("Valid-from date cannot be after the expiry date");
    }

    if (!input.lifetime && !finalExpiry && !file) {
      throw new BadRequestError("Provide an expiry date, mark as lifetime, or upload a file");
    }

    const doc = await complianceRepo.createOne(ctx, {
      vehicleId: params.id,
      type: input.type,
      issuedDate: finalIssued,
      expiryDate: finalExpiry,
      documentUrl: file?.url ?? null,
      status: calculateComplianceStatus(finalExpiry),
      isActive: true,
      lastVerifiedAt: new Date(),
    });
    await logFromRequest(req, ctx, session, {
      action: "compliance.create",
      entityType: "compliance",
      entityId: String((doc as unknown as { _id?: unknown })._id ?? ""),
      entityLabel: input.type,
      summary: input.lifetime
        ? `Added ${input.type} (lifetime validity)`
        : `Added ${input.type}${finalExpiry ? ` expiring ${finalExpiry.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}`,
      metadata: { vehicleId: params.id, lifetime: input.lifetime ?? false, expiryDate: finalExpiry },
    });
    return created(doc, "Compliance document added");
  },
  { auth: true },
);
