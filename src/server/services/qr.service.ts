import "server-only";
import QRCode from "qrcode";
import { env } from "@/lib/env";
import { storage } from "@/lib/storage";

export async function generateQRCodeForVehicle(vehicleId: string): Promise<string> {
  const origin = env.FRONTEND_URL.split(",")[0].trim();
  const publicUrl = `${origin}/public/vehicle/${vehicleId}`;
  const buffer = await QRCode.toBuffer(publicUrl, { width: 300, margin: 2 });

  const stored = await storage.save({
    fieldName: `qr-${vehicleId}`,
    originalName: `${vehicleId}.png`,
    contentType: "image/png",
    buffer,
  });

  return stored.url;
}

export async function generateQRCodeBuffer(vehicleId: string): Promise<Buffer> {
  const origin = env.FRONTEND_URL.split(",")[0].trim();
  const publicUrl = `${origin}/public/vehicle/${vehicleId}`;
  return QRCode.toBuffer(publicUrl, { width: 300, margin: 2 });
}
