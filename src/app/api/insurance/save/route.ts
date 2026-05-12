import { withRoute, parseJson } from "@/lib/api-handler";
import { created } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import { savePolicySchema } from "@/validations/insurance.schema";
import { savePolicy } from "@/server/services/insurance.service";

export const runtime = "nodejs";

export const POST = withRoute(
  async ({ req, session }) => {
    const ctx = tenantOf(session);
    const input = await parseJson(req, savePolicySchema);
    return created(await savePolicy(ctx, input), "Insurance policy saved");
  },
  { auth: true },
);
