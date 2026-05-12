import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import { BadRequestError } from "@/lib/errors";
import { tenantOf } from "@/lib/auth/tenant-context";
import * as driverRepo from "@/server/repositories/driver.repository";

export const runtime = "nodejs";

const bodySchema = z.object({
  expiryDate: z.string().optional().nullable(),
  lifetime: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .optional(),
});

export const PUT = withRoute<{ docId: string }>(
  async ({ req, params, session }) => {
    const ctx = tenantOf(session);
    const { expiryDate, lifetime } = await parseJson(req, bodySchema);

    const isLifetime = lifetime === true || lifetime === "true";
    const finalExpiry = isLifetime ? null : expiryDate ?? null;

    if (!isLifetime && !expiryDate) {
      throw new BadRequestError("Expiry date or lifetime flag is required");
    }

    const doc = await driverRepo.updateDocumentExpiry(
      ctx,
      params.docId,
      finalExpiry,
    );
    return success(doc, "Document expiry updated");
  },
  { auth: true },
);
