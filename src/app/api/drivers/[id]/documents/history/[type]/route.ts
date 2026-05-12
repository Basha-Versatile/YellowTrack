import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import { getDocumentHistory } from "@/server/services/driver.service";

export const runtime = "nodejs";

export const GET = withRoute<{ id: string; type: string }>(
  async ({ params, session }) => {
    const ctx = tenantOf(session);
    const history = await getDocumentHistory(ctx, params.id, params.type);
    return success(history, "Document history fetched");
  },
  { auth: true },
);
