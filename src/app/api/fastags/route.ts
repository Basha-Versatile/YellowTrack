import { withRoute, parseJson, parseQuery } from "@/lib/api-handler";
import { success, created } from "@/lib/http";
import {
  createFastagSchema,
  getFastagsQuerySchema,
} from "@/validations/fastag.schema";
import * as service from "@/server/services/fastag.service";

export const runtime = "nodejs";

export const GET = withRoute(
  async ({ req }) => {
    const query = parseQuery(req, getFastagsQuerySchema);
    return success(await service.getAll(query), "FASTags fetched");
  },
  { auth: true },
);

export const POST = withRoute(
  async ({ req }) => {
    const { vehicleId, tagId, provider, initialBalance } = await parseJson(
      req,
      createFastagSchema,
    );
    const fastag = await service.createFastag(
      vehicleId,
      tagId,
      provider,
      initialBalance,
    );
    return created(fastag, "FASTag created successfully");
  },
  { auth: true },
);
