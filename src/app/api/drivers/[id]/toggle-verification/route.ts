import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import { toggleAdminVerification } from "@/server/services/driver.service";

export const runtime = "nodejs";

export const PATCH = withRoute<{ id: string }>(
  async ({ params, session }) => {
    const ctx = tenantOf(session);
    const updated = await toggleAdminVerification(ctx, params.id);
    const verified = Boolean((updated as Record<string, unknown>)?.adminVerified);
    return success(
      updated,
      `Driver ${verified ? "verified" : "unverified"} successfully`,
    );
  },
  { auth: true },
);
