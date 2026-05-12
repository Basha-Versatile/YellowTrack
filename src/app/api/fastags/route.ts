import { withRoute, parseJson, parseQuery } from "@/lib/api-handler";
import { success, created } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import {
  createFastagSchema,
  getFastagsQuerySchema,
} from "@/validations/fastag.schema";
import * as service from "@/server/services/fastag.service";

export const runtime = "nodejs";

export const GET = withRoute(
  async ({ req, session }) => {
    const ctx = tenantOf(session);
    const query = parseQuery(req, getFastagsQuerySchema);
    return success(await service.getAll(ctx, query), "FASTags fetched");
  },
  { auth: true },
);

export const POST = withRoute(
  async ({ req, session }) => {
    const ctx = tenantOf(session);
    const { vehicleId, tagId, provider, initialBalance } = await parseJson(
      req,
      createFastagSchema,
    );
    const fastag = await service.createFastag(
      ctx,
      vehicleId,
      tagId,
      provider,
      initialBalance,
    );
    return created(fastag, "FASTag created successfully");
  },
  { auth: true },
);
