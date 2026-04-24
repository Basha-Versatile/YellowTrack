import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { getDriverChangeLog } from "@/server/services/driver.service";

export const runtime = "nodejs";

export const GET = withRoute<{ id: string }>(
  async ({ params }) => {
    const entries = await getDriverChangeLog(params.id);
    return success(entries, "Driver change log fetched");
  },
  { auth: true },
);
