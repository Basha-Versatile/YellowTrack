import { withRoute, parseJson } from "@/lib/api-handler";
import { success, created } from "@/lib/http";
import { createDocTypeSchema } from "@/validations/documentType.schema";
import * as service from "@/server/services/documentType.service";

export const runtime = "nodejs";

export const GET = withRoute(
  async () => {
    return success(await service.getAll(), "Document types fetched");
  },
  { auth: true },
);

export const POST = withRoute(
  async ({ req }) => {
    const input = await parseJson(req, createDocTypeSchema);
    return created(await service.create(input), "Document type created");
  },
  { auth: true },
);
