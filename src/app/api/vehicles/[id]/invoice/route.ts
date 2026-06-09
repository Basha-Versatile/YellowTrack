import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { BadRequestError } from "@/lib/errors";
import { firstFile, parseMultipart } from "@/lib/upload";
import { tenantOf } from "@/lib/auth/tenant-context";
import * as vehicleRepo from "@/server/repositories/vehicle.repository";
import { logFromRequest } from "@/server/services/activityLog.service";

export const runtime = "nodejs";

export const POST = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    const ctx = tenantOf(session);
    const { files } = await parseMultipart(req);
    const file = firstFile(files, "invoice");
    if (!file) throw new BadRequestError("Invoice file is required");

    const before = await vehicleRepo.findById(ctx, params.id);
    await vehicleRepo.update(ctx, params.id, { invoiceUrl: file.url });
    const updated = await vehicleRepo.findById(ctx, params.id);
    await logFromRequest(req, ctx, session, {
      action: "vehicle.invoice.upload",
      entityType: "vehicle",
      entityId: params.id,
      entityLabel:
        (updated as { registrationNumber?: string } | null)?.registrationNumber ??
        "Vehicle",
      summary: `Uploaded purchase invoice for ${
        (updated as { registrationNumber?: string } | null)?.registrationNumber ??
        "vehicle"
      }`,
      metadata: { invoiceUrl: file.url },
      revertable: Boolean(
        (before as { invoiceUrl?: string | null } | null)?.invoiceUrl !== undefined,
      ),
      beforeSnapshot: before
        ? { invoiceUrl: (before as { invoiceUrl?: string | null }).invoiceUrl ?? null }
        : null,
    });
    return success(updated, "Invoice uploaded successfully");
  },
  { auth: true },
);

/**
 * Clear the invoice file reference on the vehicle. The file in storage is
 * NOT deleted — keeps it recoverable from the audit log if needed. Setting
 * the field to null is enough for the UI to hide the document.
 */
export const DELETE = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    const ctx = tenantOf(session);
    const before = await vehicleRepo.findById(ctx, params.id);
    await vehicleRepo.update(ctx, params.id, { invoiceUrl: null });
    const updated = await vehicleRepo.findById(ctx, params.id);
    await logFromRequest(req, ctx, session, {
      action: "vehicle.invoice.remove",
      entityType: "vehicle",
      entityId: params.id,
      entityLabel:
        (updated as { registrationNumber?: string } | null)?.registrationNumber ??
        "Vehicle",
      summary: `Removed purchase invoice from ${
        (updated as { registrationNumber?: string } | null)?.registrationNumber ??
        "vehicle"
      }`,
      revertable: true,
      beforeSnapshot: before
        ? { invoiceUrl: (before as { invoiceUrl?: string | null }).invoiceUrl ?? null }
        : null,
    });
    return success(updated, "Invoice removed");
  },
  { auth: true },
);
