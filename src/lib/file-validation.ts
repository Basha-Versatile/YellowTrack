/**
 * Single source of truth for upload limits + standardized error messages.
 * Used by both the server (`src/lib/upload.ts`) and every client-side file
 * picker so the user sees the exact same wording wherever a file is rejected.
 *
 * Note: this file is intentionally client-safe (no `server-only`). The server
 * mirrors `MAX_UPLOAD_BYTES` from env; this client constant is the documented
 * default (`10 MB`). If you raise the backend limit, raise it here too.
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_UPLOAD_MIMES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
] as const;

const ACCEPT_LABEL = "PDF, JPG, PNG";

function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

export type FileValidationOptions = {
  /** Max file size in bytes. Defaults to MAX_UPLOAD_BYTES. */
  maxBytes?: number;
  /** MIME types to accept. Defaults to ALLOWED_UPLOAD_MIMES. */
  allowedMimes?: readonly string[];
  /** Human label for what's allowed; falls back to "PDF, JPG, PNG". */
  acceptLabel?: string;
};

export type FileValidationResult =
  | { ok: true }
  | { ok: false; reason: "SIZE" | "TYPE" | "EMPTY"; title: string; message: string };

/**
 * Validate one file against the canonical size + MIME rules.
 * Returns a structured error so callers can render via toast / inline alert /
 * whatever the surrounding UI already uses.
 */
export function validateUploadFile(
  file: File,
  options: FileValidationOptions = {},
): FileValidationResult {
  const max = options.maxBytes ?? MAX_UPLOAD_BYTES;
  const allowed = options.allowedMimes ?? ALLOWED_UPLOAD_MIMES;
  const label = options.acceptLabel ?? ACCEPT_LABEL;

  if (file.size === 0) {
    return {
      ok: false,
      reason: "EMPTY",
      title: "Empty file",
      message: `“${file.name}” is empty. Please pick a different file.`,
    };
  }
  if (file.size > max) {
    return {
      ok: false,
      reason: "SIZE",
      title: "File too large",
      message: `“${file.name}” is ${formatBytes(file.size)}. Maximum allowed is ${formatBytes(max)}.`,
    };
  }
  if (!allowed.includes(file.type)) {
    return {
      ok: false,
      reason: "TYPE",
      title: "Unsupported file type",
      message: `“${file.name}” is not a supported format. Allowed: ${label}.`,
    };
  }
  return { ok: true };
}

/**
 * Validate a list of files. Stops at the first failure (so the user sees one
 * specific error rather than a wall of identical messages).
 */
export function validateUploadFiles(
  files: File[] | FileList,
  options: FileValidationOptions = {},
): FileValidationResult {
  const arr = Array.from(files);
  for (const f of arr) {
    const res = validateUploadFile(f, options);
    if (!res.ok) return res;
  }
  return { ok: true };
}

/**
 * Convenience for `<input type="file" onChange>` handlers (single file).
 * Reads the first picked file, validates it, fires `onError(title, message)` if
 * invalid, returns the File otherwise. Always clears the input so the user can
 * pick the same file again after fixing the issue.
 */
export function pickValidatedFile(
  input: HTMLInputElement | null,
  onError: (title: string, message: string) => void,
  options?: FileValidationOptions,
): File | null {
  if (!input || !input.files?.[0]) return null;
  const file = input.files[0];
  input.value = "";
  const res = validateUploadFile(file, options);
  if (!res.ok) {
    onError(res.title, res.message);
    return null;
  }
  return file;
}

/**
 * Same as `pickValidatedFile` but for multi-file inputs. If any file fails,
 * the whole batch is rejected (keeps the upload state consistent).
 */
export function pickValidatedFiles(
  input: HTMLInputElement | null,
  onError: (title: string, message: string) => void,
  options?: FileValidationOptions,
): File[] {
  if (!input || !input.files?.length) return [];
  const files = Array.from(input.files);
  input.value = "";
  for (const file of files) {
    const res = validateUploadFile(file, options);
    if (!res.ok) {
      onError(res.title, res.message);
      return [];
    }
  }
  return files;
}
