import { withRoute } from "@/lib/api-handler";
import { created } from "@/lib/http";
import { BadRequestError, NotFoundError } from "@/lib/errors";
import { parseMultipart, manyFiles, firstString } from "@/lib/upload";
import { tenantOf } from "@/lib/auth/tenant-context";
import * as complianceRepo from "@/server/repositories/compliance.repository";
import { calculateComplianceStatus } from "@/server/services/compliance.service";
import { logFromRequest } from "@/server/services/activityLog.service";

export const runtime = "nodejs";

export const POST = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    const ctx = tenantOf(session);
    const { fields, files } = await parseMultipart(req);

    const type = firstString(fields, "type");
    if (!type) throw new BadRequestError("Type is required");

    const oldDoc = await complianceRepo.findById(ctx, params.id);
    if (!oldDoc) throw new NotFoundError("Document not found");

    const expiryDateRaw = firstString(fields, "expiryDate");
    const lifetimeRaw = firstString(fields, "lifetime");
    const isLifetime = lifetimeRaw === "true" || lifetimeRaw === "1";
    const finalExpiry = isLifetime
      ? null
      : expiryDateRaw
        ? new Date(expiryDateRaw)
        : null;

    const uploaded = manyFiles(files, "document");
    const urls = uploaded.map((f) => f.url);
    const status = calculateComplianceStatus(finalExpiry);

    const newDoc = await complianceRepo.renewDocument(ctx, params.id, {
      vehicleId: oldDoc.vehicleId,
      type: oldDoc.type,
      expiryDate: finalExpiry,
      documentUrl: urls[0] ?? null,
      documentUrls: urls,
      status,
      lastVerifiedAt: new Date(),
      isActive: true,
    });

    await logFromRequest(req, ctx, session, {
      action: "compliance.renew",
      entityType: "compliance",
      entityId: String((newDoc as unknown as { _id?: unknown })._id ?? params.id),
      entityLabel: oldDoc.type,
      summary: isLifetime
        ? `Renewed ${oldDoc.type} to lifetime validity`
        : `Renewed ${oldDoc.type}${finalExpiry ? ` to ${finalExpiry.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}`,
      metadata: { lifetime: isLifetime, expiryDate: finalExpiry, filesCount: urls.length },
    });
    return created(newDoc, "Document renewed successfully");
  },
  { auth: true },
);
