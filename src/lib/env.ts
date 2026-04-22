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
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(`Invalid environment variables:\n${issues}`);
}

export const env = parsed.data;
export type Env = typeof env;
