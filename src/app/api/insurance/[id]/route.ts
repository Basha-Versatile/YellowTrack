import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import * as service from "@/server/services/insurance.service";

export const runtime = "nodejs";

export const GET = withRoute<{ id: string }>(
  async ({ params }) => success(await service.getById(params.id), "Policy fetched"),
  { auth: true },
);
