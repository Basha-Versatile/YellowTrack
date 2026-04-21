import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { updateDocTypeSchema } from "@/validations/documentType.schema";
import * as service from "@/server/services/documentType.service";

export const runtime = "nodejs";

export const GET = withRoute<{ id: string }>(
  async ({ params }) => {
    return success(await service.getById(params.id), "Document type fetched");
  },
  { auth: true },
);

export const PUT = withRoute<{ id: string }>(
  async ({ req, params }) => {
    const input = await parseJson(req, updateDocTypeSchema);
    return success(
      await service.update(params.id, input),
      "Document type updated",
    );
  },
  { auth: true },
);

export const DELETE = withRoute<{ id: string }>(
  async ({ params }) => {
    await service.remove(params.id);
    return success(null, "Document type deleted");
  },
  { auth: true },
);
