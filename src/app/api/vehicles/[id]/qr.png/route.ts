import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Vehicle } from "@/models";
import { generateQRCodeBuffer } from "@/server/services/qr.service";
import { getRequestOrigin } from "@/lib/request-origin";
import type { RouteContext } from "@/lib/api-handler";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: RouteContext<{ id: string }>,
): Promise<NextResponse> {
  try {
    await dbConnect();
    const { id } = await context.params;
    const vehicle = await Vehicle.findById(id).lean();
    if (!vehicle) {
      return NextResponse.json(
        { success: false, message: "Vehicle not found" },
        { status: 404 },
      );
    }

    const origin = getRequestOrigin(req);
    const buffer = await generateQRCodeBuffer(String(vehicle._id), origin);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    console.error("[QR_PNG_ERROR]", err);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
