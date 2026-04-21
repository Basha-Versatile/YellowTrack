import "server-only";
import crypto from "crypto";
import path from "path";
import { put, del } from "@vercel/blob";
import type { StorageProvider, StoredFile, StorageUploadInput } from "./index";

function extFromName(name: string): string {
  return path.extname(name) || "";
}

export const blobStorage: StorageProvider = {
  async save({
    fieldName,
    originalName,
    contentType,
    buffer,
  }: StorageUploadInput): Promise<StoredFile> {
    const uniqueSuffix = `${Date.now()}-${crypto.randomInt(1e9)}`;
    const filename = `${fieldName}-${uniqueSuffix}${extFromName(originalName)}`;

    const { url } = await put(filename, buffer, {
      access: "public",
      contentType,
      addRandomSuffix: false,
    });

    return {
      url,
      key: url,
      size: buffer.byteLength,
      contentType,
      originalName,
    };
  },

  async remove(key: string): Promise<void> {
    if (!key) return;
    try {
      await del(key);
    } catch {
      // ignore missing blob
    }
  },
};
