import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { AppError, UnauthorizedError } from "@/lib/errors";
import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { getSessionFromRequest } from "@/lib/auth/session";
import { tenantOf } from "@/lib/auth/tenant-context";
import {
  exportVehicles,
  listExportableFields,
} from "@/server/services/vehicleExport.service";

export const runtime = "nodejs";

const bodySchema = z.object({
  format: z.enum(["csv", "xlsx"]).default("xlsx"),
  fields: z.array(z.string().min(1)).default([]),
  filters: z
    .object({
      lifecycle: z.enum(["ACTIVE", "SOLD"]).optional(),
      groupId: z.string().optional(),
      vehicleUsage: z.enum(["PRIVATE", "COMMERCIAL"]).optional(),
      status: z.enum(["GREEN", "YELLOW", "RED"]).optional(),
      brand: z.string().optional(),
      search: z.string().optional(),
    })
    .optional(),
});

/**
 * GET — lightweight catalog of every selectable field grouped by category,
 * so the export modal can render the picker without duplicating the
 * registry on the client.
 */
export const GET = withRoute(
  async () => {
    const fields = listExportableFields();
    return success(fields, "Exportable fields");
  },
  { auth: true },
);

/**
 * POST — streams a CSV or XLSX file built from the user's field selection
 * and filters. Returns binary directly (no JSON wrapper) so the browser
 * can pipe it straight to a download.
 */
export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const session = await getSessionFromRequest(req);
    if (!session) throw new UnauthorizedError();
    const ctx = tenantOf(session);
    const json = await req.json().catch(() => ({}));
    const input = bodySchema.parse(json);
    const { buffer, filename, contentType } = await exportVehicles(ctx, input);
    return new NextResponse(buffer as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { success: false, message: err.message },
        { status: err.statusCode },
      );
    }
    console.error("[vehicles/export]", err);
    return NextResponse.json(
      { success: false, message: "Could not build export" },
      { status: 500 },
    );
  }
}
