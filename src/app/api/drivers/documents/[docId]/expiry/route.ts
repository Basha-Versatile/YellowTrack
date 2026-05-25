import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import { BadRequestError } from "@/lib/errors";
import { tenantOf } from "@/lib/auth/tenant-context";
import * as driverRepo from "@/server/repositories/driver.repository";

export const runtime = "nodejs";

const bodySchema = z.object({
  issuedDate: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  lifetime: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .optional(),
});

export const PUT = withRoute<{ docId: string }>(
  async ({ req, params, session }) => {
    const ctx = tenantOf(session);
    const { issuedDate, expiryDate, lifetime } = await parseJson(req, bodySchema);

    const isLifetime = lifetime === true || lifetime === "true";
    const finalExpiry = isLifetime ? null : expiryDate ?? null;
    // `issuedDate` semantics: undefined = leave untouched, null/"" = clear,
    // string = parse and set. Lifetime forces clear.
    const finalIssued: Date | null | undefined = isLifetime
      ? null
      : issuedDate === undefined
        ? undefined
        : issuedDate === null || issuedDate === ""
          ? null
          : new Date(issuedDate);

    if (!isLifetime && !expiryDate) {
      throw new BadRequestError("Expiry date or lifetime flag is required");
    }
    if (
      finalIssued instanceof Date &&
      finalExpiry &&
      finalIssued > new Date(finalExpiry)
    ) {
      throw new BadRequestError("Valid-from date cannot be after the expiry date");
    }

    const doc = await driverRepo.updateDocumentExpiry(
      ctx,
      params.docId,
      finalExpiry,
      finalIssued,
    );
    return success(doc, "Document expiry updated");
  },
  { auth: true },
);
