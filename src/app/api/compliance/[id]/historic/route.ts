import { withRoute } from "@/lib/api-handler";
import { created } from "@/lib/http";
import { BadRequestError, NotFoundError } from "@/lib/errors";
import { parseMultipart, manyFiles, firstString } from "@/lib/upload";
import { tenantOf } from "@/lib/auth/tenant-context";
import * as complianceRepo from "@/server/repositories/compliance.repository";
import { calculateComplianceStatus } from "@/server/services/compliance.service";
import { logFromRequest } from "@/server/services/activityLog.service";

export const runtime = "nodejs";

/**
 * POST /api/compliance/:id/historic
 *
 * Adds a PAST version of the document referenced by :id (typically the
 * currently-active doc). Inputs: issued + expiry dates and a file. Creates a
 * standalone ComplianceDocument with isActive=false so the active row keeps
 * driving the compliance status — the historic row just shows up in the
 * History modal with its own dates.
 */
export const POST = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    const ctx = tenantOf(session);
    const { fields, files } = await parseMultipart(req);

    const issuedRaw = firstString(fields, "issuedDate");
    const expiryRaw = firstString(fields, "expiryDate");
    if (!issuedRaw && !expiryRaw) {
      throw new BadRequestError(
        "Provide at least an issued date or expiry date for the historic version",
      );
    }
    const issuedDate = issuedRaw ? new Date(issuedRaw) : null;
    const expiryDate = expiryRaw ? new Date(expiryRaw) : null;
    if (
      issuedDate &&
      expiryDate &&
      issuedDate.getTime() > expiryDate.getTime()
    ) {
      throw new BadRequestError(
        "Valid-from date must be on or before the expiry date",
      );
    }

    const ref = await complianceRepo.findById(ctx, params.id);
    if (!ref) throw new NotFoundError("Document not found");

    const uploaded = manyFiles(files, "document");
    const urls = uploaded.map((f) => f.url);
    if (urls.length === 0) {
      throw new BadRequestError("Attach a file for the historic version");
    }

    const created_doc = await complianceRepo.createOne(ctx, {
      vehicleId: ref.vehicleId,
      type: ref.type,
      issuedDate,
      expiryDate,
      documentUrl: urls[0],
      documentUrls: urls,
      status: calculateComplianceStatus(expiryDate),
      isActive: false,
      archivedAt: new Date(),
      lastVerifiedAt: new Date(),
    });

    await logFromRequest(req, ctx, session, {
      action: "compliance.create",
      entityType: "compliance",
      entityId: String((created_doc as unknown as { _id?: unknown })._id ?? ""),
      entityLabel: ref.type,
      summary: `Added historic ${ref.type}${
        expiryDate
          ? ` (expired ${expiryDate.toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })})`
          : ""
      }`,
      metadata: {
        vehicleId: String(ref.vehicleId),
        historic: true,
        issuedDate,
        expiryDate,
      },
      revertable: true,
    });

    return created(created_doc, "Historic version added");
  },
  { auth: true },
);
