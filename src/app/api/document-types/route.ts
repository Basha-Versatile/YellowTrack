import { withRoute, parseJson } from "@/lib/api-handler";
import { success, created } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import { createDocTypeSchema } from "@/validations/documentType.schema";
import * as service from "@/server/services/documentType.service";

export const runtime = "nodejs";

export const GET = withRoute(
  async ({ session }) => {
    const ctx = tenantOf(session);
    return success(await service.getAll(ctx), "Document types fetched");
  },
  { auth: true },
);

export const POST = withRoute(
  async ({ req, session }) => {
    const ctx = tenantOf(session);
    const input = await parseJson(req, createDocTypeSchema);
    return created(await service.create(ctx, input), "Document type created");
  },
  { auth: true },
);
