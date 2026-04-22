import "server-only";
import QRCode from "qrcode";
import { env } from "@/lib/env";
import { storage } from "@/lib/storage";

function resolveOrigin(origin?: string): string {
  if (origin) return origin.replace(/\/$/, "");
  return env.FRONTEND_URL.split(",")[0].trim().replace(/\/$/, "");
}

export async function generateQRCodeForVehicle(
  vehicleId: string,
  origin?: string,
): Promise<string> {
  const base = resolveOrigin(origin);
  const publicUrl = `${base}/public/vehicle/${vehicleId}`;
  const buffer = await QRCode.toBuffer(publicUrl, { width: 300, margin: 2 });

  const stored = await storage.save({
    fieldName: `qr-${vehicleId}`,
    originalName: `${vehicleId}.png`,
    contentType: "image/png",
    buffer,
  });

  return stored.url;
}

export async function generateQRCodeBuffer(
  vehicleId: string,
  origin?: string,
): Promise<Buffer> {
  const base = resolveOrigin(origin);
  const publicUrl = `${base}/public/vehicle/${vehicleId}`;
  return QRCode.toBuffer(publicUrl, { width: 300, margin: 2 });
}
