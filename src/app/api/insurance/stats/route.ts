import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import * as service from "@/server/services/insurance.service";

export const runtime = "nodejs";

export const GET = withRoute(
  async () => success(await service.getStats(), "Stats fetched"),
  { auth: true },
);
