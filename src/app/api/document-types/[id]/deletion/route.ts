import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import { UnauthorizedError } from "@/lib/errors";
import { requestDeletion } from "@/server/services/documentType.service";

export const runtime = "nodejs";

/**
 * Step 1 of OTP-gated delete — generates a 6-digit code, stores it with a
 * 10-minute TTL, and emails it to the calling user. Returns the expiry
 * timestamp so the UI can render a countdown.
 */
export const POST = withRoute<{ id: string }>(
  async ({ params, session }) => {
    if (!session) throw new UnauthorizedError();
    const ctx = tenantOf(session);
    const result = await requestDeletion(ctx, params.id, session.id);
    return success(result, "Deletion code sent to your email");
  },
  { auth: true },
);
