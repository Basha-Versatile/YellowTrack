import { withRoute } from "@/lib/api-handler";
import { success, created } from "@/lib/http";
import { BadRequestError, NotFoundError } from "@/lib/errors";
import { VehicleSale, VehicleDriverMapping } from "@/models";
import { parseMultipart, manyFiles } from "@/lib/upload";
import * as vehicleRepo from "@/server/repositories/vehicle.repository";
import {
  tenantOf,
  tenantFilter,
  tenantStamp,
} from "@/lib/auth/tenant-context";
import { logFromRequest } from "@/server/services/activityLog.service";

export const runtime = "nodejs";

export const GET = withRoute<{ id: string }>(
  async ({ params, session }) => {
    const ctx = tenantOf(session);
    const sale = await VehicleSale.findOne(
      tenantFilter(ctx, { vehicleId: params.id }),
    ).lean();
    return success(sale, "Sale fetched");
  },
  { auth: true },
);

export const POST = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    const ctx = tenantOf(session);
    const vehicle = await vehicleRepo.findById(ctx, params.id);
    if (!vehicle) throw new NotFoundError("Vehicle not found");

    const { fields, files } = await parseMultipart(req);
    const val = (k: string) =>
      Array.isArray(fields[k]) ? (fields[k] as string[])[0] : (fields[k] as string | undefined);

    const buyerName = val("buyerName")?.trim();
    const buyerPhone = val("buyerPhone")?.trim();
    const saleDate = val("saleDate");
    if (!buyerName || !buyerPhone || !saleDate) {
      throw new BadRequestError("Buyer name, phone, and sale date are required");
    }

    const buyerEmail = val("buyerEmail")?.trim() || null;
    const notes = val("notes")?.trim() || null;
    const pendingChallansCleared = val("pendingChallansCleared") === "true" || val("pendingChallansCleared") === "1";

    let soldPrice: number | null = null;
    const soldPriceRaw = val("soldPrice");
    if (soldPriceRaw !== undefined && soldPriceRaw !== "") {
      const n = parseFloat(soldPriceRaw);
      if (!Number.isFinite(n) || n < 0) {
        throw new BadRequestError("Sold price must be a non-negative number");
      }
      soldPrice = n;
    }

    const buyerDocs = manyFiles(files, "buyerDocs").map((f) => f.url);
    const transferDocs = manyFiles(files, "transferDocs").map((f) => f.url);

    // Upsert sale doc (one per vehicle — supports re-selling after cancel)
    const stamp = tenantStamp(ctx);
    const existing = await VehicleSale.findOne(
      tenantFilter(ctx, { vehicleId: params.id }),
    );
    const saleData = {
      ...stamp,
      vehicleId: params.id,
      buyerName,
      buyerPhone,
      buyerEmail,
      soldPrice,
      saleDate: new Date(saleDate),
      pendingChallansCleared,
      buyerDocumentUrls: existing
        ? [...((existing.buyerDocumentUrls as string[] | undefined) ?? []), ...buyerDocs]
        : buyerDocs,
      transferDocumentUrls: existing
        ? [...((existing.transferDocumentUrls as string[] | undefined) ?? []), ...transferDocs]
        : transferDocs,
      notes,
    };
    const sale = existing
      ? await VehicleSale.findOneAndUpdate(
          tenantFilter(ctx, { vehicleId: params.id }),
          saleData,
          { new: true, strict: false },
        )
      : await VehicleSale.create(saleData);

    // Mark vehicle as SOLD and unassign any active driver mapping
    await vehicleRepo.update(ctx, params.id, { status: "SOLD" });
    await VehicleDriverMapping.updateMany(
      tenantFilter(ctx, { vehicleId: params.id, isActive: true }),
      { isActive: false, unassignedAt: new Date() },
    );

    const regNo = (vehicle as { registrationNumber?: string }).registrationNumber ?? params.id;
    await logFromRequest(req, ctx, session, {
      action: existing ? "vehicle.sale.update" : "vehicle.sale.create",
      entityType: "vehicle_sale",
      entityId: params.id,
      entityLabel: regNo,
      summary: existing
        ? `Updated sale of ${regNo} to ${buyerName}`
        : `Sold ${regNo} to ${buyerName}`,
      metadata: { buyerName, buyerPhone, soldPrice, saleDate },
    });

    // Fan out sale-invoice email to tenant admins on first create only.
    if (!existing) {
      const baseUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";
      const { dispatchSaleInvoice } = await import("@/server/services/alertDispatcher.service");
      dispatchSaleInvoice({
        ctx,
        buyerName,
        vehicleRegNo: regNo,
        saleAmount: soldPrice ?? 0,
        saleDate: new Date(saleDate),
        invoiceUrl: `${baseUrl}/vehicles/${params.id}`,
      }).catch((err) =>
        console.error("[sale] invoice email dispatch failed:", err instanceof Error ? err.message : err),
      );
    }

    return existing
      ? success(sale, "Sale updated")
      : created(sale, "Vehicle marked as sold");
  },
  { auth: true },
);

export const DELETE = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    const ctx = tenantOf(session);
    let label = params.id;
    let priorStatus: string | null = null;
    try {
      const v = await vehicleRepo.findById(ctx, params.id);
      label = (v as { registrationNumber?: string } | null)?.registrationNumber ?? params.id;
      priorStatus = (v as { status?: string } | null)?.status ?? null;
    } catch { /* ignore */ }
    await VehicleSale.deleteOne(tenantFilter(ctx, { vehicleId: params.id }));
    await vehicleRepo.update(ctx, params.id, { status: "ACTIVE" });
    await logFromRequest(req, ctx, session, {
      action: "vehicle.sale.cancel",
      entityType: "vehicle_sale",
      entityId: params.id,
      entityLabel: label,
      summary: `Cancelled sale of ${label}`,
      // Revert support — restoring the vehicle's prior SOLD status. The
      // deleted VehicleSale row isn't rebuilt; user re-records the sale.
      revertable: priorStatus === "SOLD",
      beforeSnapshot: priorStatus ? { status: priorStatus } : null,
    });
    return success(null, "Sale cancelled — vehicle is active again");
  },
  { auth: true },
);
