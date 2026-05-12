import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { NotFoundError } from "@/lib/errors";
import { z } from "zod";
import { tokenScopedTenantOf } from "@/lib/auth/tenant-context";
import * as logRepo from "@/server/repositories/vehiclePublicAccessLog.repository";
import * as vehicleRepo from "@/server/repositories/vehicle.repository";

export const runtime = "nodejs";

const bodySchema = z.object({
  target: z.string().trim().min(1).max(80),
  action: z.enum(["VIEW", "DOWNLOAD"]),
  documentUrl: z.string().optional().nullable(),
  accessorName: z.string().trim().max(80).optional().nullable(),
  accessorPhone: z.string().trim().max(20).optional().nullable(),
});

export const POST = withRoute<{ id: string }>(
  async ({ req, params }) => {
    const body = await parseJson(req, bodySchema);
    // Public route: resolve the vehicle cross-tenant by ID, then scope the
    // access-log insert to the vehicle's own tenant.
    const vehicle = await vehicleRepo.findByIdAnyTenant(params.id);
    if (!vehicle) throw new NotFoundError("Vehicle not found");
    const ctx = tokenScopedTenantOf(String(vehicle.tenantId));

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      req.headers.get("x-real-ip") ??
      null;
    const userAgent = req.headers.get("user-agent");
    await logRepo.logAccess(ctx, {
      vehicleId: params.id,
      target: body.target,
      action: body.action,
      documentUrl: body.documentUrl,
      accessorName: body.accessorName,
      accessorPhone: body.accessorPhone,
      ip,
      userAgent: userAgent ? userAgent.slice(0, 400) : null,
    });
    return success({ logged: true }, "Access recorded");
  },
);
