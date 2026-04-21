import "server-only";
import { env } from "../env";
import { localStorage } from "./local";
import { blobStorage } from "./blob";

export type StoredFile = {
  url: string; // publicly-accessible URL (e.g. /uploads/abc.pdf)
  key: string; // provider-internal identifier (for deletes)
  size: number;
  contentType: string;
  originalName: string;
};

export type StorageUploadInput = {
  fieldName: string;
  originalName: string;
  contentType: string;
  buffer: Buffer;
};

export interface StorageProvider {
  save(input: StorageUploadInput): Promise<StoredFile>;
  remove(key: string): Promise<void>;
}

function resolveProvider(): StorageProvider {
  switch (env.STORAGE_DRIVER) {
    case "local":
      return localStorage;
    case "blob":
      return blobStorage;
    // future: case "s3": return s3Storage;
    // future: case "cloudinary": return cloudinaryStorage;
    default:
      return localStorage;
  }
}

export const storage: StorageProvider = resolveProvider();
