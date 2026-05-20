import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import { uploadComplianceDocSchema } from "@/validations/document.schema";
import * as complianceRepo from "@/server/repositories/compliance.repository";
import { calculateComplianceStatus } from "@/server/services/compliance.service";
import { logFromRequest } from "@/server/services/activityLog.service";

export const runtime = "nodejs";

export const PUT = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    const ctx = tenantOf(session);
    const input = await parseJson(req, uploadComplianceDocSchema);
    const rawExpiry = input.lifetime ? null : (input.expiryDate as Date | string | null | undefined);
    const finalExpiry: Date | null = !rawExpiry
      ? null
      : rawExpiry instanceof Date
        ? rawExpiry
        : new Date(rawExpiry);
    const status = calculateComplianceStatus(finalExpiry);
    const doc = await complianceRepo.updateExpiry(ctx, params.id, finalExpiry, status);
    const d = doc as { type?: string };
    await logFromRequest(req, ctx, session, {
      action: "compliance.update",
      entityType: "compliance",
      entityId: params.id,
      entityLabel: d.type ?? "Compliance document",
      summary: input.lifetime
        ? `Set ${d.type ?? "document"} to lifetime validity`
        : `Updated ${d.type ?? "document"} expiry${finalExpiry ? ` to ${finalExpiry.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}`,
      metadata: { lifetime: input.lifetime ?? false, expiryDate: finalExpiry },
    });
    return success(doc, "Compliance document updated successfully");
  },
  { auth: true },
);

export const DELETE = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    const ctx = tenantOf(session);
    const removed = await complianceRepo.removeById(ctx, params.id);
    const d = removed as { type?: string } | null;
    await logFromRequest(req, ctx, session, {
      action: "compliance.delete",
      entityType: "compliance",
      entityId: params.id,
      entityLabel: d?.type ?? "Compliance document",
      summary: `Deleted ${d?.type ?? "compliance document"}`,
    });
    return success(removed, "Compliance document removed");
  },
  { auth: true },
);
