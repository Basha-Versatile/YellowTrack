import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import { tenantOf } from "@/lib/auth/tenant-context";
import { UnauthorizedError } from "@/lib/errors";
import { confirmDeletion } from "@/server/services/documentType.service";

export const runtime = "nodejs";

const bodySchema = z.object({
  otp: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export const POST = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    if (!session) throw new UnauthorizedError();
    const ctx = tenantOf(session);
    const { otp } = await parseJson(req, bodySchema);
    await confirmDeletion(ctx, params.id, session.id, otp);
    return success(null, "Document type deleted");
  },
  { auth: true },
);
