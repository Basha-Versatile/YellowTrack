import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { publicDriverUpdateSchema } from "@/validations/publicDriver.schema";
import {
  getDriverByToken,
  updateDriverByToken,
} from "@/server/services/public.service";

export const runtime = "nodejs";

export const GET = withRoute<{ token: string }>(async ({ params }) => {
  return success(await getDriverByToken(params.token), "Driver data fetched");
});

export const PUT = withRoute<{ token: string }>(async ({ req, params }) => {
  const validated = await parseJson(req, publicDriverUpdateSchema);
  const updated = await updateDriverByToken(
    params.token,
    validated as Record<string, unknown>,
  );
  return success(updated, "Driver profile updated successfully");
});
