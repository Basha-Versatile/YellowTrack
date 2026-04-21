import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import * as service from "@/server/services/fastag.service";

export const runtime = "nodejs";

export const GET = withRoute(
  async () => success(await service.getStats(), "FASTag stats fetched"),
  { auth: true },
);
