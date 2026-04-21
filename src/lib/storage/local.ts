import "server-only";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { env } from "../env";
import type { StorageProvider, StoredFile, StorageUploadInput } from "./index";

const UPLOAD_ROOT = path.resolve(process.cwd(), env.UPLOAD_DIR);

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

function extFromName(name: string): string {
  const ext = path.extname(name);
  return ext || "";
}

export const localStorage: StorageProvider = {
  async save({
    fieldName,
    originalName,
    contentType,
    buffer,
  }: StorageUploadInput): Promise<StoredFile> {
    await ensureDir(UPLOAD_ROOT);

    const uniqueSuffix = `${Date.now()}-${crypto.randomInt(1e9)}`;
    const filename = `${fieldName}-${uniqueSuffix}${extFromName(originalName)}`;
    const absPath = path.join(UPLOAD_ROOT, filename);

    await fs.writeFile(absPath, buffer);

    return {
      url: `${env.PUBLIC_UPLOADS_BASE.replace(/\/$/, "")}/${filename}`,
      key: filename,
      size: buffer.byteLength,
      contentType,
      originalName,
    };
  },

  async remove(key: string): Promise<void> {
    if (!key) return;
    const safeKey = path.basename(key);
    const absPath = path.join(UPLOAD_ROOT, safeKey);
    try {
      await fs.unlink(absPath);
    } catch {
      // ignore missing file
    }
  },
};
