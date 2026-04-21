import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { getDocumentHistory } from "@/server/services/driver.service";

export const runtime = "nodejs";

export const GET = withRoute<{ id: string; type: string }>(
  async ({ params }) => {
    const history = await getDocumentHistory(params.id, params.type);
    return success(history, "Document history fetched");
  },
  { auth: true },
);
