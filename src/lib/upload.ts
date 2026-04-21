import "server-only";
import { NextRequest } from "next/server";
import { env } from "./env";
import { BadRequestError } from "./errors";
import { storage, type StoredFile } from "./storage";

export const ALLOWED_UPLOAD_MIMES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
] as const;

export type UploadedFile = StoredFile & { fieldName: string; buffer: Buffer };

export type ParsedMultipart = {
  fields: Record<string, string | string[]>;
  files: Record<string, UploadedFile | UploadedFile[]>;
};

function pushIntoRecord<T>(
  target: Record<string, T | T[]>,
  key: string,
  value: T,
): void {
  const existing = target[key];
  if (existing === undefined) {
    target[key] = value;
    return;
  }
  target[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
}

function assertAllowed(file: File): void {
  if (file.size > env.MAX_UPLOAD_BYTES) {
    throw new BadRequestError(
      `File ${file.name} exceeds max size of ${Math.round(env.MAX_UPLOAD_BYTES / 1024 / 1024)}MB`,
    );
  }
  if (!ALLOWED_UPLOAD_MIMES.includes(file.type as (typeof ALLOWED_UPLOAD_MIMES)[number])) {
    throw new BadRequestError("Only PDF, JPEG, and PNG files are allowed");
  }
}

/**
 * Parses a multipart/form-data request into typed fields + persisted files.
 * Mirrors multer's per-field-name contract:
 *   - single file per field → files[field] is UploadedFile
 *   - multiple files per field → files[field] is UploadedFile[]
 */
export async function parseMultipart(req: NextRequest): Promise<ParsedMultipart> {
  const form = await req.formData().catch(() => {
    throw new BadRequestError("Invalid multipart body");
  });

  const fields: Record<string, string | string[]> = {};
  const files: Record<string, UploadedFile | UploadedFile[]> = {};

  for (const [key, value] of form.entries()) {
    if (value instanceof File) {
      if (value.size === 0 && !value.name) continue;
      assertAllowed(value);
      const buffer = Buffer.from(await value.arrayBuffer());
      const stored = await storage.save({
        fieldName: key,
        originalName: value.name || "file",
        contentType: value.type || "application/octet-stream",
        buffer,
      });
      pushIntoRecord<UploadedFile>(files, key, { ...stored, fieldName: key, buffer });
    } else {
      pushIntoRecord<string>(fields, key, value);
    }
  }

  return { fields, files };
}

export function firstString(
  fields: ParsedMultipart["fields"],
  key: string,
): string | undefined {
  const v = fields[key];
  return Array.isArray(v) ? v[0] : v;
}

export function firstFile(
  files: ParsedMultipart["files"],
  key: string,
): UploadedFile | undefined {
  const v = files[key];
  return Array.isArray(v) ? v[0] : v;
}

export function manyFiles(
  files: ParsedMultipart["files"],
  key: string,
): UploadedFile[] {
  const v = files[key];
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}
