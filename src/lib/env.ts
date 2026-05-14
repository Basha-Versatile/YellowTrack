import "server-only";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

  UPLOAD_DIR: z.string().default("public/uploads"),
  PUBLIC_UPLOADS_BASE: z.string().default("/uploads"),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  STORAGE_DRIVER: z.enum(["local", "blob", "s3", "cloudinary"]).default("local"),
  // Required when STORAGE_DRIVER=blob — Vercel auto-injects this when the
  // project has Vercel Blob storage attached.
  BLOB_READ_WRITE_TOKEN: z.string().optional(),

  // Vehicle RC lookup (Surepass kyc-api)
  SUREPASS_ENABLED: z
    .string()
    .optional()
    .transform((v) => v !== "false"),
  SUREPASS_BASE_URL: z.string().default("https://kyc-api.surepass.io/api/v1"),
  SUREPASS_API_TOKEN: z.string().optional(),
  SUREPASS_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),

  // Driving License lookup (Surepass sandbox — different endpoint + token)
  SUREPASS_DL_ENABLED: z
    .string()
    .optional()
    .transform((v) => v !== "false"),
  SUREPASS_DL_BASE_URL: z.string().default("https://sandbox.surepass.io/api/v1"),
  SUREPASS_DL_API_TOKEN: z.string().optional(),
  SUREPASS_DL_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),

  CRON_SECRET: z.string().min(16).optional(),

  FRONTEND_URL: z.string().default("http://localhost:3000"),

  // Email provider (Resend). When RESEND_API_KEY is unset, `sendEmail()` falls
  // back to console.log so dev / preview environments don't need an account.
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z
    .string()
    .default("YellowTrack <no-reply@yellowtrack.app>"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(`Invalid environment variables:\n${issues}`);
}

const data = parsed.data;

// Cross-field invariants — fail fast at boot so a misconfigured deploy doesn't
// silently lose uploads.
if (data.NODE_ENV === "production") {
  if (data.STORAGE_DRIVER === "local") {
    throw new Error(
      "[env] STORAGE_DRIVER=local is unsafe in production: serverless filesystems are ephemeral, " +
        "so uploads will disappear on the next cold start. Set STORAGE_DRIVER=blob and attach " +
        "Vercel Blob (which provides BLOB_READ_WRITE_TOKEN automatically), or use s3 / cloudinary.",
    );
  }
}
if (data.STORAGE_DRIVER === "blob" && !data.BLOB_READ_WRITE_TOKEN) {
  throw new Error(
    "[env] STORAGE_DRIVER=blob requires BLOB_READ_WRITE_TOKEN. " +
      "On Vercel, this is auto-injected when you attach a Blob store to the project.",
  );
}

export const env = data;
export type Env = typeof env;
