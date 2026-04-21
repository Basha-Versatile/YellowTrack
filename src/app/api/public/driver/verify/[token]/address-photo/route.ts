import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import { deleteAddressPhoto } from "@/server/services/public.service";

export const runtime = "nodejs";

const bodySchema = z.object({
  type: z.enum(["current", "permanent"]),
  url: z.string().min(1),
});

export const DELETE = withRoute<{ token: string }>(async ({ req, params }) => {
  const { type, url } = await parseJson(req, bodySchema);
  const result = await deleteAddressPhoto(params.token, type, url);
  return success(result, "Photo removed");
});
