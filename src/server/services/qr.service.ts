import "server-only";
import QRCode from "qrcode";
import { promises as fs } from "fs";
import path from "path";
import { env } from "@/lib/env";

const QR_DIR_REL = "qr";

export async function generateQRCodeForVehicle(vehicleId: string): Promise<string> {
  const uploadRoot = path.resolve(process.cwd(), env.UPLOAD_DIR);
  const qrDir = path.join(uploadRoot, QR_DIR_REL);
  await fs.mkdir(qrDir, { recursive: true });

  const origin = env.FRONTEND_URL.split(",")[0].trim();
  const publicUrl = `${origin}/public/vehicle/${vehicleId}`;
  const filename = `${vehicleId}.png`;
  const filePath = path.join(qrDir, filename);

  await QRCode.toFile(filePath, publicUrl, { width: 300, margin: 2 });

  return `${env.PUBLIC_UPLOADS_BASE.replace(/\/$/, "")}/${QR_DIR_REL}/${filename}`;
}

export async function generateQRCodeBuffer(vehicleId: string): Promise<Buffer> {
  const origin = env.FRONTEND_URL.split(",")[0].trim();
  const publicUrl = `${origin}/public/vehicle/${vehicleId}`;
  return QRCode.toBuffer(publicUrl, { width: 300, margin: 2 });
}
