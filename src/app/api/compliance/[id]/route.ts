import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { BadRequestError } from "@/lib/errors";
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
    const rawIssued = input.lifetime ? null : (input.issuedDate as Date | string | null | undefined);
    // `issuedDate` semantics here:
    //   - `lifetime: true` → clear it (null)
    //   - explicit value provided → set to that date
    //   - missing from payload → leave existing value alone (undefined)
    const finalIssued: Date | null | undefined =
      input.lifetime
        ? null
        : rawIssued === undefined
          ? undefined
          : rawIssued === null || rawIssued === ""
            ? null
            : rawIssued instanceof Date
              ? rawIssued
              : new Date(rawIssued);
    if (
      finalIssued instanceof Date &&
      finalExpiry instanceof Date &&
      finalIssued > finalExpiry
    ) {
      throw new BadRequestError(
        "Valid-from date cannot be after the expiry date",
      );
    }
    // Capture the doc *before* the mutation so the activity entry can be
    // reverted later. Only the editable fields are snapshotted.
    const before = await complianceRepo.findById(ctx, params.id);
    const status = calculateComplianceStatus(finalExpiry);
    const doc = await complianceRepo.updateExpiry(
      ctx,
      params.id,
      finalExpiry,
      status,
      finalIssued,
    );
    const d = doc as { type?: string };
    const b = before as
      | (Record<string, unknown> & {
          expiryDate?: Date | null;
          issuedDate?: Date | null;
          status?: string;
          isLifetime?: boolean;
        })
      | null;
    await logFromRequest(req, ctx, session, {
      action: "compliance.update",
      entityType: "compliance",
      entityId: params.id,
      entityLabel: d.type ?? "Compliance document",
      summary: input.lifetime
        ? `Set ${d.type ?? "document"} to lifetime validity`
        : `Updated ${d.type ?? "document"} expiry${finalExpiry ? ` to ${finalExpiry.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}`,
      metadata: { lifetime: input.lifetime ?? false, expiryDate: finalExpiry },
      revertable: Boolean(b),
      beforeSnapshot: b
        ? {
            expiryDate: b.expiryDate ?? null,
            issuedDate: b.issuedDate ?? null,
            status: b.status ?? null,
            isLifetime: b.isLifetime ?? false,
          }
        : null,
    });
    return success(doc, "Compliance document updated successfully");
  },
  { auth: true },
);

export const DELETE = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    const ctx = tenantOf(session);
    // Snapshot the doc BEFORE deletion so revert can rebuild it.
    const before = await complianceRepo.findById(ctx, params.id);
    const removed = await complianceRepo.removeById(ctx, params.id);
    const d = removed as { type?: string } | null;
    await logFromRequest(req, ctx, session, {
      action: "compliance.delete",
      entityType: "compliance",
      entityId: params.id,
      entityLabel: d?.type ?? "Compliance document",
      summary: `Deleted ${d?.type ?? "compliance document"}`,
      revertable: Boolean(before),
      beforeSnapshot: before as Record<string, unknown> | null,
    });
    return success(removed, "Compliance document removed");
  },
  { auth: true },
);
